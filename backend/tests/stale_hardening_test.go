package tests

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/config"
	"backend/models"
	"backend/routes"
	"backend/seeders"
	"backend/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupStaleTestEnv(t *testing.T, submitRateMax int) (*config.AppConfig, *gorm.DB, *fiber.App, *spyEmailSender) {
	t.Helper()
	baseCfg, err := config.LoadConfig()
	require.NoError(t, err)

	cfgCopy := *baseCfg
	cfgCopy.UploadDir = t.TempDir()

	db, err := config.ConnectDB(&cfgCopy)
	require.NoError(t, err)
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, &cfgCopy))

	spy := newSpyEmailSender(nil)
	app := routes.NewApp(&cfgCopy, routes.AppOptions{
		LoginRateLimitMax:        100,
		LoginRateLimitWindow:     time.Minute,
		ReportSubmitRateLimitMax: submitRateMax,
		ReportTrackRateLimitMax:  100,
		EmailSender:              spy,
	})
	return &cfgCopy, db, app, spy
}

func createAgedTestReport(t *testing.T, db *gorm.DB, status string, daysAgo int, isStale bool) models.Report {
	t.Helper()
	code := "UG-S" + strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", "")[:4])
	createdAt := time.Now().AddDate(0, 0, -daysAgo)
	rep := models.Report{
		TicketCode:      code,
		ReporterName:    "Stale Tester",
		ReporterEmail:   "stale@student.gunadarma.ac.id",
		NPM:             "51428888",
		PhoneNumber:     "081288889999",
		ItemName:        "Barang Uji Stale",
		LossLocation:    "Kampus D",
		LossDatetime:    createdAt.Add(-time.Hour),
		ItemDescription: "Deskripsi barang uji",
		SecretTraits:    "Ciri rahasia uji",
		KtmKrsPath:      "dummy.png",
		Status:          status,
		IsStale:         isStale,
	}
	require.NoError(t, db.Create(&rep).Error)
	require.NoError(t, db.Model(&models.Report{}).Where("id = ?", rep.ID).UpdateColumn("created_at", createdAt).Error)
	require.NoError(t, db.Where("id = ?", rep.ID).First(&rep).Error)
	return rep
}

func TestStaleJobMarksOldBelumAdaReportsIdempotently(t *testing.T) {
	_, db, _, _ := setupStaleTestEnv(t, 100)

	repOldBelumAda := createAgedTestReport(t, db, models.ReportStatusBelumAda, 31, false)
	repFreshBelumAda := createAgedTestReport(t, db, models.ReportStatusBelumAda, 15, false)
	repOldPerluVerif := createAgedTestReport(t, db, models.ReportStatusPerluVerifikasi, 40, false)
	repOldSelesai := createAgedTestReport(t, db, models.ReportStatusSelesai, 45, false)

	reportIDs := []uint{repOldBelumAda.ID, repFreshBelumAda.ID, repOldPerluVerif.ID, repOldSelesai.ID}
	t.Cleanup(func() {
		_ = db.Where("target_table = ? AND target_id IN ?", "reports", reportIDs).Delete(&models.AuditLog{}).Error
		_ = db.Where("id IN ?", reportIDs).Delete(&models.Report{}).Error
	})

	// First run: should mark only repOldBelumAda
	count1, err := services.MarkStaleReports(db, time.Now(), 30)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count1, int64(1))

	var checkOld, checkFresh, checkVerif, checkSelesai models.Report
	require.NoError(t, db.Where("id = ?", repOldBelumAda.ID).First(&checkOld).Error)
	require.NoError(t, db.Where("id = ?", repFreshBelumAda.ID).First(&checkFresh).Error)
	require.NoError(t, db.Where("id = ?", repOldPerluVerif.ID).First(&checkVerif).Error)
	require.NoError(t, db.Where("id = ?", repOldSelesai.ID).First(&checkSelesai).Error)

	assert.True(t, checkOld.IsStale, "Belum Ada aged 31 days must become is_stale=true")
	assert.False(t, checkFresh.IsStale, "Belum Ada aged 15 days must stay is_stale=false")
	assert.False(t, checkVerif.IsStale, "Perlu Verifikasi aged 40 days must stay is_stale=false")
	assert.False(t, checkSelesai.IsStale, "Selesai aged 45 days must stay is_stale=false")

	// System audit log recorded with admin_id = NULL
	var sysLogs []models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "REPORT_MARKED_STALE", repOldBelumAda.ID).Find(&sysLogs).Error)
	require.Len(t, sysLogs, 1)
	assert.Nil(t, sysLogs[0].AdminID)

	// Second run immediately: 100% idempotent (0 newly marked, 0 duplicate audit logs)
	count2, err := services.MarkStaleReports(db, time.Now(), 30)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count2)

	var logCountAfter int64
	require.NoError(t, db.Model(&models.AuditLog{}).Where("action = ? AND target_id = ?", "REPORT_MARKED_STALE", repOldBelumAda.ID).Count(&logCountAfter).Error)
	assert.Equal(t, int64(1), logCountAfter)
}

func TestRestoreStaleReportRBACAndReAgingProtection(t *testing.T) {
	cfg, db, app, _ := setupStaleTestEnv(t, 100)

	repStale := createAgedTestReport(t, db, models.ReportStatusBelumAda, 35, true)
	repActive := createAgedTestReport(t, db, models.ReportStatusBelumAda, 5, false)
	repStaleRejected := createAgedTestReport(t, db, models.ReportStatusDitolak, 35, true)

	reportIDs := []uint{repStale.ID, repActive.ID, repStaleRejected.ID}
	t.Cleanup(func() {
		_ = db.Where("target_table = ? AND target_id IN ?", "reports", reportIDs).Delete(&models.AuditLog{}).Error
		_ = db.Where("id IN ?", reportIDs).Delete(&models.Report{}).Error
	})

	// 1. Unauthenticated -> 401
	resp, _ := doJSONRequest(t, app, "POST", "/api/v1/admin/reports/"+repStale.TicketCode+"/restore", nil, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	// 2. Petugas Loket -> 403 FORBIDDEN naming role & reports.restore
	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	petugasHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	resp, body := doJSONRequest(t, app, "POST", "/api/v1/admin/reports/"+repStale.TicketCode+"/restore", nil, petugasHeaders)
	assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "FORBIDDEN", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Message, "Petugas Loket")
	assert.Contains(t, errEnv.Error.Message, "reports.restore")

	// 3. Admin on non-stale report -> 409 REPORT_NOT_STALE
	adminLogin := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	adminHeaders := map[string]string{"Authorization": "Bearer " + adminLogin.Data.AccessToken}

	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/reports/"+repActive.TicketCode+"/restore", nil, adminHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "REPORT_NOT_STALE", errEnv.Error.Code)

	// 4. Admin on stale Ditolak report -> 409 INVALID_REPORT_STATUS
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/reports/"+repStaleRejected.TicketCode+"/restore", nil, adminHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_REPORT_STATUS", errEnv.Error.Code)

	// 5. Admin restores stale Belum Ada report -> 200, is_stale=false, restored_at set, REPORT_RESTORED audit log
	restorePayload, _ := json.Marshal(map[string]string{
		"admin_notes": "Dipulihkan karena ada barang temuan baru yang berpotensi cocok.",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/reports/"+repStale.TicketCode+"/restore", restorePayload, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	var restoredResp struct {
		Data struct {
			TicketCode string     `json:"ticket_code"`
			IsStale    bool       `json:"is_stale"`
			RestoredAt *time.Time `json:"restored_at"`
			AdminNotes *string    `json:"admin_notes"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &restoredResp))
	assert.Equal(t, repStale.TicketCode, restoredResp.Data.TicketCode)
	assert.False(t, restoredResp.Data.IsStale)
	require.NotNil(t, restoredResp.Data.RestoredAt)
	require.NotNil(t, restoredResp.Data.AdminNotes)
	assert.Contains(t, *restoredResp.Data.AdminNotes, "Dipulihkan")

	var restoredLog models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "REPORT_RESTORED", repStale.ID).First(&restoredLog).Error)

	// 6. Queue filter confirms restored report moved from is_stale=true to is_stale=false
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/reports?is_stale=true&search="+repStale.TicketCode, nil, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode)
	var staleList struct {
		Meta struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(body, &staleList))
	assert.Equal(t, int64(0), staleList.Meta.Total)

	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/reports?is_stale=false&search="+repStale.TicketCode, nil, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode)
	require.NoError(t, json.Unmarshal(body, &staleList))
	assert.Equal(t, int64(1), staleList.Meta.Total)

	// 7. Re-running stale job must NOT immediately re-flag the restored report
	reFlagged, err := services.MarkStaleReports(db, time.Now(), 30)
	require.NoError(t, err)
	assert.Equal(t, int64(0), reFlagged)

	var afterJob models.Report
	require.NoError(t, db.Where("id = ?", repStale.ID).First(&afterJob).Error)
	assert.False(t, afterJob.IsStale)
}

func TestSecurityHardeningSuite(t *testing.T) {
	_, db, app, spy := setupStaleTestEnv(t, 2)

	// 1. Private storage non-exposure via public/static URLs
	ticket := submitSampleReport(t, app, spy, defaultReportFormFields(), false)
	var rep models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket).First(&rep).Error)
	t.Cleanup(func() {
		_ = db.Where("id = ?", rep.ID).Delete(&models.Report{}).Error
	})

	for _, publicPath := range []string{
		"/storage/private/" + rep.KtmKrsPath,
		"/" + rep.KtmKrsPath,
		"/api/v1/storage/private/" + rep.KtmKrsPath,
	} {
		req := httptest.NewRequest("GET", publicPath, nil)
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		resp.Body.Close()
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode, "private file path %s must return 404", publicPath)
	}

	// 2. Security headers including Content-Security-Policy
	reqHealth := httptest.NewRequest("GET", "/health", nil)
	respHealth, err := app.Test(reqHealth, -1)
	require.NoError(t, err)
	respHealth.Body.Close()
	assert.Equal(t, "nosniff", respHealth.Header.Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", respHealth.Header.Get("X-Frame-Options"))
	assert.Equal(t, "no-referrer", respHealth.Header.Get("Referrer-Policy"))
	assert.Equal(t, "default-src 'none'; frame-ancestors 'none'", respHealth.Header.Get("Content-Security-Policy"))

	// 3. Public report submit rate limit -> 3rd attempt returns 429 REPORT_SUBMIT_RATE_LIMITED
	// (Note: 1st request was submitSampleReport above; send 2nd valid/invalid, then 3rd hits limiter)
	_, _ = doMultipartReportRequest(t, app, map[string]string{"reporter_name": ""}, nil)
	status3, body3 := doMultipartReportRequest(t, app, map[string]string{"reporter_name": ""}, nil)
	assert.Equal(t, fiber.StatusTooManyRequests, status3)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body3, &errEnv))
	assert.Equal(t, "REPORT_SUBMIT_RATE_LIMITED", errEnv.Error.Code)

	// 4. Production config hardening validation
	prodBase := config.AppConfig{
		AppEnv:     "production",
		DBHost:     "localhost",
		DBUser:     "postgres",
		DBPassword: "strong-db-password",
		DBName:     "uglf_db",
		DBPort:     "5432",
	}

	shortJWT := prodBase
	shortJWT.JWTSecret = "too-short"
	shortJWT.CORSAllowedOrigins = "https://admin.uglf.local"
	err = config.ValidateConfig(&shortJWT)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")

	wildcardCORS := prodBase
	wildcardCORS.JWTSecret = "0123456789abcdef0123456789abcdef"
	wildcardCORS.CORSAllowedOrigins = "*"
	err = config.ValidateConfig(&wildcardCORS)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CORS_ALLOWED_ORIGINS")

	validProd := prodBase
	validProd.JWTSecret = "0123456789abcdef0123456789abcdef"
	validProd.CORSAllowedOrigins = "https://uglf.local,https://admin.uglf.local"
	assert.NoError(t, config.ValidateConfig(&validProd))
}
