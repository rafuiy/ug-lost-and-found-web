package tests

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"backend/config"
	"backend/middlewares"
	"backend/models"
	"backend/routes"
	"backend/seeders"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type apiErrorEnvelope struct {
	Error struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields"`
	} `json:"error"`
}

type loginSuccessEnvelope struct {
	Data struct {
		AccessToken string    `json:"access_token"`
		TokenType   string    `json:"token_type"`
		ExpiresAt   time.Time `json:"expires_at"`
		Admin       struct {
			ID          uint     `json:"id"`
			Username    string   `json:"username"`
			Email       string   `json:"email"`
			Name        string   `json:"name"`
			Role        string   `json:"role"`
			RoleDisplay string   `json:"role_display"`
			Permissions []string `json:"permissions"`
			IsActive    bool     `json:"is_active"`
		} `json:"admin"`
	} `json:"data"`
}

func setupAuthTestEnv(t *testing.T) (*config.AppConfig, *gorm.DB, *fiber.App) {
	t.Helper()
	cfg, err := config.LoadConfig()
	require.NoError(t, err)

	db, err := config.ConnectDB(cfg)
	require.NoError(t, err)
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, cfg))

	app := routes.NewApp(cfg, routes.AppOptions{
		LoginRateLimitMax:    100,
		LoginRateLimitWindow: time.Minute,
	})
	return cfg, db, app
}

func doJSONRequest(t *testing.T, app *fiber.App, method, path string, rawBody []byte, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	var bodyReader io.Reader
	if rawBody != nil {
		bodyReader = bytes.NewReader(rawBody)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp, b
}

func loginForTest(t *testing.T, app *fiber.App, identifier, password string) loginSuccessEnvelope {
	t.Helper()
	payload, err := json.Marshal(map[string]string{
		"email":    identifier,
		"password": password,
	})
	require.NoError(t, err)

	resp, body := doJSONRequest(t, app, "POST", "/api/v1/auth/login", payload, nil)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, "login failed: %s", string(body))

	var out loginSuccessEnvelope
	require.NoError(t, json.Unmarshal(body, &out))
	require.NotEmpty(t, out.Data.AccessToken)
	return out
}

func TestLoginValidationAndMalformedJSON(t *testing.T) {
	_, _, app := setupAuthTestEnv(t)

	// 1. Empty body -> 400 EMPTY_REQUEST_BODY
	resp, body := doJSONRequest(t, app, "POST", "/api/v1/auth/login", []byte("   "), nil)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "EMPTY_REQUEST_BODY", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Message, "kosong")

	// 2. Malformed JSON syntax -> 400 INVALID_JSON_SYNTAX
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", []byte(`{"email": "admin@gmail.com",`), nil)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_JSON_SYNTAX", errEnv.Error.Code)

	// 3. Unknown field in JSON (anti-mass assignment) -> 400 UNKNOWN_FIELD
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", []byte(`{"email":"admin@gmail.com","password":"x","role":"admin"}`), nil)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "UNKNOWN_FIELD", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Message, "role")
	assert.Contains(t, errEnv.Error.Fields, "role")

	// 4. Missing required fields -> 422 VALIDATION_ERROR
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", []byte(`{"email":"   ","password":""}`), nil)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "email")
	assert.Contains(t, errEnv.Error.Fields, "password")
}

func TestLoginSuccessAndFailureCases(t *testing.T) {
	cfg, db, app := setupAuthTestEnv(t)

	// 1. Wrong password -> 401 INVALID_CREDENTIALS & audit log recorded without password
	wrongPayload, _ := json.Marshal(map[string]string{
		"email":    "admin@gmail.com",
		"password": "definitely-wrong-password",
	})
	resp, body := doJSONRequest(t, app, "POST", "/api/v1/auth/login", wrongPayload, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_CREDENTIALS", errEnv.Error.Code)

	var failedLog models.AuditLog
	require.NoError(t, db.Where("action = ?", "AUTH_LOGIN_FAILED").Order("created_at DESC").First(&failedLog).Error)
	assert.NotContains(t, string(failedLog.Payload), "definitely-wrong-password")

	// 2. Non-existent user -> 401 INVALID_CREDENTIALS (same message to prevent enumeration)
	unknownPayload, _ := json.Marshal(map[string]string{
		"email":    "nonexistent@gmail.com",
		"password": "any-password",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", unknownPayload, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	var errEnv2 apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv2))
	assert.Equal(t, "INVALID_CREDENTIALS", errEnv2.Error.Code)
	assert.Equal(t, errEnv.Error.Message, errEnv2.Error.Message)

	// 3. Admin login by email -> 200 with 8 permissions, no password_hash
	adminResp := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	assert.Equal(t, "Bearer", adminResp.Data.TokenType)
	assert.Equal(t, "admin", adminResp.Data.Admin.Username)
	assert.Equal(t, "admin@gmail.com", adminResp.Data.Admin.Email)
	assert.Equal(t, models.RoleAdmin, adminResp.Data.Admin.Role)
	assert.Len(t, adminResp.Data.Admin.Permissions, 8)

	// 4. Petugas Loket login by email -> 200 with 6 permissions
	petugasResp := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	assert.Equal(t, "petugas", petugasResp.Data.Admin.Username)
	assert.Equal(t, "petugas@gmail.com", petugasResp.Data.Admin.Email)
	assert.Equal(t, models.RolePetugasLoket, petugasResp.Data.Admin.Role)
	assert.Len(t, petugasResp.Data.Admin.Permissions, 6)

	// 5. Login by username works as well
	byUsernamePayload, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": cfg.SeedAdminPassword,
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", byUsernamePayload, nil)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	// 6. Inactive account -> 403 ACCOUNT_INACTIVE (with guaranteed cleanup)
	t.Cleanup(func() {
		_ = db.Model(&models.Admin{}).Where("email = ?", "petugas@gmail.com").Update("is_active", true).Error
	})
	require.NoError(t, db.Model(&models.Admin{}).Where("email = ?", "petugas@gmail.com").Update("is_active", false).Error)

	inactivePayload, _ := json.Marshal(map[string]string{
		"email":    "petugas@gmail.com",
		"password": cfg.SeedPetugasPassword,
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/auth/login", inactivePayload, nil)
	assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "ACCOUNT_INACTIVE", errEnv.Error.Code)
}

func TestAuthMiddlewareAndJWTValidation(t *testing.T) {
	cfg, _, app := setupAuthTestEnv(t)

	// 1. Missing Authorization header -> 401 MISSING_AUTH_HEADER
	resp, body := doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "MISSING_AUTH_HEADER", errEnv.Error.Code)

	// 2. Bad Authorization format -> 401 INVALID_AUTH_FORMAT
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, map[string]string{
		"Authorization": "Basic abc123",
	})
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_AUTH_FORMAT", errEnv.Error.Code)

	// 3. Token in query string -> 401 TOKEN_IN_QUERY_FORBIDDEN
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me?token=abc", nil, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "TOKEN_IN_QUERY_FORBIDDEN", errEnv.Error.Code)

	// 4. Unsigned alg: none token -> 401 TOKEN_INVALID_ALGORITHM
	algNoneHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	algNonePayload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"999999999","token_type":"access"}`))
	algNoneToken := algNoneHeader + "." + algNonePayload + "."
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + algNoneToken,
	})
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "TOKEN_INVALID_ALGORITHM", errEnv.Error.Code)

	// 5. Wrong signing secret -> 401 TOKEN_SIGNATURE_INVALID
	wrongSecretToken := jwt.NewWithClaims(jwt.SigningMethodHS256, utils.JWTClaims{
		AdminID:   "999999999",
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	wrongSigned, err := wrongSecretToken.SignedString([]byte("definitely-wrong-secret"))
	require.NoError(t, err)
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + wrongSigned,
	})
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "TOKEN_SIGNATURE_INVALID", errEnv.Error.Code)

	// 6. Expired JWT -> 401 TOKEN_EXPIRED
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, utils.JWTClaims{
		AdminID:   "999999999",
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
		},
	})
	expiredSigned, err := expiredToken.SignedString([]byte(cfg.JWTSecret))
	require.NoError(t, err)
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + expiredSigned,
	})
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "TOKEN_EXPIRED", errEnv.Error.Code)

	// 7. Valid JWT on GET /api/v1/auth/me -> 200 + security headers
	login := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + login.Data.AccessToken,
	})
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", resp.Header.Get("X-Frame-Options"))
	assert.Equal(t, "no-referrer", resp.Header.Get("Referrer-Policy"))
	assert.NotContains(t, string(body), "password_hash")
}

func TestRBACPermissionAndRoleSeparation(t *testing.T) {
	cfg, _, app := setupAuthTestEnv(t)

	rbacTest := app.Group("/api/v1/test-rbac", middlewares.AuthMiddleware(cfg))
	rbacTest.Get("/audit-logs", middlewares.RequirePermission("audit_logs.read"), func(c *fiber.Ctx) error {
		return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{"allowed": true})
	})
	rbacTest.Post("/restore", middlewares.RequirePermission("reports.restore"), func(c *fiber.Ctx) error {
		return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{"allowed": true})
	})
	rbacTest.Post("/inventory", middlewares.RequirePermission("inventories.write"), func(c *fiber.Ctx) error {
		return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{"allowed": true})
	})
	rbacTest.Get("/admin-only", middlewares.RequireRole(models.RoleAdmin), func(c *fiber.Ctx) error {
		return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{"allowed": true})
	})

	adminLogin := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)

	adminAuth := map[string]string{"Authorization": "Bearer " + adminLogin.Data.AccessToken}
	petugasAuth := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	// Admin allowed everywhere
	for _, tc := range []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/test-rbac/audit-logs"},
		{"POST", "/api/v1/test-rbac/restore"},
		{"POST", "/api/v1/test-rbac/inventory"},
		{"GET", "/api/v1/test-rbac/admin-only"},
	} {
		resp, _ := doJSONRequest(t, app, tc.method, tc.path, nil, adminAuth)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode, "admin should access %s %s", tc.method, tc.path)
	}

	// Petugas allowed on inventories.write
	resp, _ := doJSONRequest(t, app, "POST", "/api/v1/test-rbac/inventory", nil, petugasAuth)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// Petugas forbidden on audit_logs.read, reports.restore, and admin-only
	for _, tc := range []struct {
		method string
		path   string
		needle string
	}{
		{"GET", "/api/v1/test-rbac/audit-logs", "audit_logs.read"},
		{"POST", "/api/v1/test-rbac/restore", "reports.restore"},
		{"GET", "/api/v1/test-rbac/admin-only", models.RoleAdmin},
	} {
		resp, body := doJSONRequest(t, app, tc.method, tc.path, nil, petugasAuth)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode, "petugas must be forbidden on %s %s", tc.method, tc.path)
		var errEnv apiErrorEnvelope
		require.NoError(t, json.Unmarshal(body, &errEnv))
		assert.Equal(t, "FORBIDDEN", errEnv.Error.Code)
		assert.Contains(t, errEnv.Error.Message, tc.needle)
	}
}

func TestLogoutRevokesToken(t *testing.T) {
	cfg, _, app := setupAuthTestEnv(t)

	login := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + login.Data.AccessToken}

	// Logout -> 200
	resp, body := doJSONRequest(t, app, "POST", "/api/v1/auth/logout", nil, authHeaders)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	// Reuse revoked token on /me -> 401 TOKEN_REVOKED
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/auth/me", nil, authHeaders)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "TOKEN_REVOKED", errEnv.Error.Code)
}

func TestLoginRateLimiter(t *testing.T) {
	cfg, err := config.LoadConfig()
	require.NoError(t, err)
	_, err = config.ConnectDB(cfg)
	require.NoError(t, err)

	rateLimitedApp := routes.NewApp(cfg, routes.AppOptions{
		LoginRateLimitMax:    3,
		LoginRateLimitWindow: 10 * time.Second,
	})

	badPayload, _ := json.Marshal(map[string]string{
		"email":    "admin@gmail.com",
		"password": "wrong-password",
	})

	for i := 0; i < 3; i++ {
		resp, _ := doJSONRequest(t, rateLimitedApp, "POST", "/api/v1/auth/login", badPayload, nil)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode, "attempt %d should return 401", i+1)
	}

	resp, body := doJSONRequest(t, rateLimitedApp, "POST", "/api/v1/auth/login", badPayload, nil)
	assert.Equal(t, fiber.StatusTooManyRequests, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "LOGIN_RATE_LIMITED", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Message, "10s")
}

// idStr formats an auto-increment primary key for request paths and bodies.
func idStr(id uint) string {
	return strconv.FormatUint(uint64(id), 10)
}
