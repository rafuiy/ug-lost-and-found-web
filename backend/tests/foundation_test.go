package tests

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/config"
	"backend/models"
	"backend/routes"
	"backend/seeders"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestFoundationMigrationAndIdempotentSeeding(t *testing.T) {
	cfg, err := config.LoadConfig()
	require.NoError(t, err)
	db, err := config.ConnectDB(cfg)
	require.NoError(t, err)

	// Run AutoMigrate and SeedAll twice consecutively to guarantee idempotency.
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, cfg))
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, cfg))

	var permCount int64
	require.NoError(t, db.Model(&models.Permission{}).Count(&permCount).Error)
	assert.Equal(t, int64(8), permCount)

	var roleCount int64
	require.NoError(t, db.Model(&models.Role{}).Count(&roleCount).Error)
	assert.Equal(t, int64(2), roleCount)

	var adminRole models.Role
	require.NoError(t, db.Preload("Permissions").Where("name = ?", models.RoleAdmin).First(&adminRole).Error)
	assert.Equal(t, "Admin", adminRole.DisplayName)
	assert.Len(t, adminRole.Permissions, 8)

	var petugasRole models.Role
	require.NoError(t, db.Preload("Permissions").Where("name = ?", models.RolePetugasLoket).First(&petugasRole).Error)
	assert.Equal(t, "Petugas Loket", petugasRole.DisplayName)
	assert.Len(t, petugasRole.Permissions, 6)

	petugasSlugs := make(map[string]bool, len(petugasRole.Permissions))
	for _, p := range petugasRole.Permissions {
		petugasSlugs[p.Slug] = true
	}
	assert.False(t, petugasSlugs["audit_logs.read"], "petugas_loket must not have audit_logs.read")
	assert.False(t, petugasSlugs["reports.restore"], "petugas_loket must not have reports.restore")

	var adminCount int64
	require.NoError(t, db.Model(&models.Admin{}).Count(&adminCount).Error)
	assert.Equal(t, int64(2), adminCount)

	var superAdmin models.Admin
	require.NoError(t, db.Preload("Role").Where("email = ?", "admin@gmail.com").First(&superAdmin).Error)
	assert.Equal(t, "admin", superAdmin.Username)
	assert.Equal(t, models.RoleAdmin, superAdmin.Role.Name)
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(superAdmin.PasswordHash), []byte(cfg.SeedAdminPassword)))

	var petugas models.Admin
	require.NoError(t, db.Preload("Role").Where("email = ?", "petugas@gmail.com").First(&petugas).Error)
	assert.Equal(t, "petugas", petugas.Username)
	assert.Equal(t, models.RolePetugasLoket, petugas.Role.Name)
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(petugas.PasswordHash), []byte(cfg.SeedPetugasPassword)))

	// PasswordHash must never leak in JSON serialization.
	rawAdmin, err := json.Marshal(superAdmin)
	require.NoError(t, err)
	assert.NotContains(t, string(rawAdmin), "password_hash")
	assert.NotContains(t, string(rawAdmin), superAdmin.PasswordHash)
}

func TestPrivateFilePathsExcludedFromJSON(t *testing.T) {
	itemImg := "/storage/private/item.jpg"
	report := models.Report{
		TicketCode:      "UG-7X9K2",
		ReporterName:    "Budi",
		ReporterEmail:   "budi@student.gunadarma.ac.id",
		NPM:             "51421890",
		PhoneNumber:     "081234567890",
		ItemName:        "Dompet",
		LossLocation:    "Kampus D",
		LossDatetime:    time.Now(),
		ItemDescription: "Kulit cokelat",
		SecretTraits:    "Stiker kecil",
		KtmKrsPath:      "/storage/private/ktm.jpg",
		ItemImagePath:   &itemImg,
		Status:          models.ReportStatusBelumAda,
	}

	rawReport, err := json.Marshal(report)
	require.NoError(t, err)
	reportStr := string(rawReport)
	assert.NotContains(t, reportStr, "ktm_krs_path")
	assert.NotContains(t, reportStr, "item_image_path")
	assert.NotContains(t, reportStr, report.KtmKrsPath)
	assert.NotContains(t, reportStr, itemImg)

	handover := models.Handover{
		ReportID:          report.ID,
		InventoryID:       1,
		AdminID:           1,
		RecipientName:     "Budi",
		RecipientNPM:      "51421890",
		HandoverProofPath: "/storage/private/proof.jpg",
	}

	rawHandover, err := json.Marshal(handover)
	require.NoError(t, err)
	handoverStr := string(rawHandover)
	assert.NotContains(t, handoverStr, "handover_proof_path")
	assert.NotContains(t, handoverStr, handover.HandoverProofPath)
}

func TestHealthAndNotFoundEndpoints(t *testing.T) {
	cfg, err := config.LoadConfig()
	require.NoError(t, err)
	_, err = config.ConnectDB(cfg)
	require.NoError(t, err)

	app := routes.NewApp(cfg)

	// Test GET /health
	reqHealth := httptest.NewRequest("GET", "/health", nil)
	respHealth, err := app.Test(reqHealth, -1)
	require.NoError(t, err)
	defer respHealth.Body.Close()

	assert.Equal(t, fiber.StatusOK, respHealth.StatusCode)
	bodyHealth, err := io.ReadAll(respHealth.Body)
	require.NoError(t, err)

	var healthPayload struct {
		Data struct {
			Status   string `json:"status"`
			Service  string `json:"service"`
			Database string `json:"database"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(bodyHealth, &healthPayload))
	assert.Equal(t, "ok", healthPayload.Data.Status)
	assert.Equal(t, "uglf-backend", healthPayload.Data.Service)
	assert.Equal(t, "connected", healthPayload.Data.Database)

	// Test GET /api/v1/nonexistent -> 404 JSON envelope with clear endpoint info
	req404 := httptest.NewRequest("GET", "/api/v1/nonexistent", nil)
	resp404, err := app.Test(req404, -1)
	require.NoError(t, err)
	defer resp404.Body.Close()

	assert.Equal(t, fiber.StatusNotFound, resp404.StatusCode)
	body404, err := io.ReadAll(resp404.Body)
	require.NoError(t, err)

	var errPayload struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(body404, &errPayload))
	assert.Equal(t, "NOT_FOUND", errPayload.Error.Code)
	assert.Contains(t, errPayload.Error.Message, "/api/v1/nonexistent")
	assert.True(t, strings.TrimSpace(errPayload.Error.Message) != "")
}

func TestConfigValidationAndSecretProtection(t *testing.T) {
	err := config.ValidateConfig(&config.AppConfig{})
	require.Error(t, err)
	for _, key := range []string{"DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_PORT", "JWT_SECRET"} {
		assert.Contains(t, err.Error(), key)
	}

	cfg, err := config.LoadConfig()
	require.NoError(t, err)

	rawCfg, err := json.Marshal(cfg)
	require.NoError(t, err)
	var cfgMap map[string]interface{}
	require.NoError(t, json.Unmarshal(rawCfg, &cfgMap))
	for _, secretKey := range []string{"DBPassword", "JWTSecret", "SMTPPassword", "SeedAdminPassword", "SeedPetugasPassword"} {
		assert.NotContains(t, cfgMap, secretKey)
	}

	synthetic := &config.AppConfig{
		DBUser:              "dbuser",
		DBPassword:          "unique-secret-db-password",
		JWTSecret:           "unique-jwt-secret",
		SMTPPassword:        "unique-smtp-password",
		SeedAdminPassword:   "unique-admin-password",
		SeedPetugasPassword: "unique-petugas-password",
	}
	rawSynth, err := json.Marshal(synthetic)
	require.NoError(t, err)
	synthStr := string(rawSynth)
	for _, secret := range []string{
		synthetic.DBPassword,
		synthetic.JWTSecret,
		synthetic.SMTPPassword,
		synthetic.SeedAdminPassword,
		synthetic.SeedPetugasPassword,
	} {
		assert.NotContains(t, synthStr, secret)
	}
}
