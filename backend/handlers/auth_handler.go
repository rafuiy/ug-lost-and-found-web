package handlers

import (
	"errors"
	"log"
	"sort"
	"strings"
	"time"

	"backend/config"
	"backend/middlewares"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type AdminProfileResponse struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	Role        string    `json:"role"`
	RoleDisplay string    `json:"role_display"`
	Permissions []string  `json:"permissions"`
	IsActive    bool      `json:"is_active"`
}

type LoginResponse struct {
	AccessToken string               `json:"access_token"`
	TokenType   string               `json:"token_type"`
	ExpiresAt   time.Time            `json:"expires_at"`
	Admin       AdminProfileResponse `json:"admin"`
}

type AuthHandler struct {
	Cfg *config.AppConfig
}

func NewAuthHandler(cfg *config.AppConfig) *AuthHandler {
	return &AuthHandler{Cfg: cfg}
}

// Login authenticates an admin or petugas loket by email or username and returns an HS256 JWT.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Email))
	if identifier == "" {
		identifier = strings.ToLower(strings.TrimSpace(req.Username))
	}

	fieldErrors := make(map[string]string)
	if identifier == "" {
		fieldErrors["email"] = "Email atau username wajib diisi."
	}
	if req.Password == "" {
		fieldErrors["password"] = "Password wajib diisi."
	}
	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data login belum lengkap. Periksa field email/username dan password.",
			fieldErrors,
		)
	}

	if config.DB == nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"DB_NOT_INITIALIZED",
			"Koneksi database belum siap.",
			nil,
		)
	}

	var admin models.Admin
	err := config.DB.Preload("Role.Permissions").
		Where("LOWER(email) = ? OR LOWER(username) = ?", identifier, identifier).
		First(&admin).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.SendError(
				c,
				fiber.StatusUnauthorized,
				"INVALID_CREDENTIALS",
				"Email/username atau password salah.",
				nil,
			)
		}
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"DB_QUERY_ERROR",
			"Gagal memeriksa kredensial akun di database.",
			nil,
		)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		if auditErr := utils.RecordAuditLog(
			config.DB,
			&admin.ID,
			"AUTH_LOGIN_FAILED",
			"admins",
			admin.ID,
			map[string]interface{}{
				"identifier": identifier,
				"reason":     "invalid_password",
			},
			c.IP(),
		); auditErr != nil {
			log.Printf("Failed to record AUTH_LOGIN_FAILED audit log: %v", auditErr)
		}

		return utils.SendError(
			c,
			fiber.StatusUnauthorized,
			"INVALID_CREDENTIALS",
			"Email/username atau password salah.",
			nil,
		)
	}

	if !admin.IsActive {
		return utils.SendError(
			c,
			fiber.StatusForbidden,
			"ACCOUNT_INACTIVE",
			"Akun Anda saat ini dinonaktifkan. Hubungi Administrator.",
			nil,
		)
	}

	tokenStr, _, expiresAt, err := utils.GenerateAccessToken(&admin, h.Cfg)
	if err != nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"TOKEN_GENERATION_FAILED",
			"Gagal membuat token autentikasi.",
			nil,
		)
	}

	if err := utils.RecordAuditLog(
		config.DB,
		&admin.ID,
		"AUTH_LOGIN_SUCCESS",
		"admins",
		admin.ID,
		map[string]interface{}{
			"username": admin.Username,
			"email":    admin.Email,
			"role":     admin.Role.Name,
		},
		c.IP(),
	); err != nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"AUDIT_LOG_FAILED",
			"Gagal mencatat log audit autentikasi.",
			nil,
		)
	}

	return utils.SendSuccess(c, fiber.StatusOK, LoginResponse{
		AccessToken: tokenStr,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		Admin:       buildAdminProfile(&admin),
	})
}

// Me returns the profile and permissions of the currently authenticated admin/petugas.
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	admin, ok := c.Locals(middlewares.LocalAdmin).(*models.Admin)
	if !ok || admin == nil {
		return utils.SendError(
			c,
			fiber.StatusUnauthorized,
			"UNAUTHORIZED",
			"Sesi autentikasi tidak ditemukan. Silakan login terlebih dahulu.",
			nil,
		)
	}

	return utils.SendSuccess(c, fiber.StatusOK, buildAdminProfile(admin))
}

// Logout revokes the current JWT token (jti) so it cannot be reused and logs the event.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	adminID, okID := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	jti, okJTI := c.Locals(middlewares.LocalTokenJTI).(string)
	exp, okExp := c.Locals(middlewares.LocalTokenExp).(time.Time)

	if !okID || !okJTI || jti == "" {
		return utils.SendError(
			c,
			fiber.StatusUnauthorized,
			"UNAUTHORIZED",
			"Sesi autentikasi tidak valid atau token tidak ditemukan.",
			nil,
		)
	}
	if !okExp || exp.IsZero() {
		exp = time.Now().Add(8 * time.Hour)
	}

	if config.DB == nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"DB_NOT_INITIALIZED",
			"Koneksi database belum siap.",
			nil,
		)
	}

	revoked := models.RevokedToken{
		JTI:       jti,
		AdminID:   adminID,
		ExpiresAt: exp,
		RevokedAt: time.Now(),
	}
	if err := config.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "jti"}},
		DoNothing: true,
	}).Create(&revoked).Error; err != nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"LOGOUT_FAILED",
			"Gagal mencabut token sesi di database.",
			nil,
		)
	}

	if err := utils.RecordAuditLog(
		config.DB,
		&adminID,
		"AUTH_LOGOUT",
		"admins",
		adminID,
		map[string]interface{}{
			"jti": jti,
		},
		c.IP(),
	); err != nil {
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"AUDIT_LOG_FAILED",
			"Gagal mencatat log audit logout.",
			nil,
		)
	}

	return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{
		"message": "Logout berhasil. Token autentikasi telah dicabut.",
	})
}

func buildAdminProfile(admin *models.Admin) AdminProfileResponse {
	perms := make([]string, 0, len(admin.Role.Permissions))
	for _, p := range admin.Role.Permissions {
		perms = append(perms, p.Slug)
	}
	sort.Strings(perms)

	return AdminProfileResponse{
		ID:          admin.ID,
		Username:    admin.Username,
		Email:       admin.Email,
		Name:        admin.Name,
		Role:        admin.Role.Name,
		RoleDisplay: admin.Role.DisplayName,
		Permissions: perms,
		IsActive:    admin.IsActive,
	}
}
