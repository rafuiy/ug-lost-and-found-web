package tests

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http/httptest"
	"sync"
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

type spyEmailSender struct {
	mu      sync.Mutex
	sent    []services.EmailPayload
	failErr error
	notify  chan services.EmailPayload
}

func newSpyEmailSender(failErr error) *spyEmailSender {
	return &spyEmailSender{
		failErr: failErr,
		notify:  make(chan services.EmailPayload, 20),
	}
}

func (s *spyEmailSender) Send(msg services.EmailPayload) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failErr != nil {
		return s.failErr
	}
	s.sent = append(s.sent, msg)
	return nil
}

func (s *spyEmailSender) SendAsync(msg services.EmailPayload) {
	go func() {
		_ = s.Send(msg)
		s.notify <- msg
	}()
}

func (s *spyEmailSender) waitNextEmail(t *testing.T) services.EmailPayload {
	t.Helper()
	select {
	case msg := <-s.notify:
		return msg
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for async email dispatch")
		return services.EmailPayload{}
	}
}

func (s *spyEmailSender) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.sent)
}

func setupAdminReportTestEnv(t *testing.T, failErr error) (*config.AppConfig, *gorm.DB, *fiber.App, *spyEmailSender, string) {
	t.Helper()
	baseCfg, err := config.LoadConfig()
	require.NoError(t, err)

	cfgCopy := *baseCfg
	uploadDir := t.TempDir()
	cfgCopy.UploadDir = uploadDir

	db, err := config.ConnectDB(&cfgCopy)
	require.NoError(t, err)
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, &cfgCopy))

	spy := newSpyEmailSender(failErr)
	app := routes.NewApp(&cfgCopy, routes.AppOptions{
		LoginRateLimitMax:        100,
		LoginRateLimitWindow:     time.Minute,
		ReportSubmitRateLimitMax: 100,
		ReportTrackRateLimitMax:  100,
		EmailSender:              spy,
	})
	return &cfgCopy, db, app, spy, uploadDir
}

func submitSampleReport(t *testing.T, app *fiber.App, spy *spyEmailSender, fields map[string]string, withItemImage bool) string {
	t.Helper()
	files := []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "ktm.png", content: validPNGBytes()},
	}
	if withItemImage {
		files = append(files, multipartFileSpec{fieldName: "item_image", fileName: "item.jpg", content: validJPEGBytes()})
	}

	status, body := doMultipartReportRequest(t, app, fields, files)
	require.Equal(t, fiber.StatusCreated, status, string(body))

	var out struct {
		Data struct {
			TicketCode string `json:"ticket_code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &out))
	if spy != nil {
		msg := spy.waitNextEmail(t)
		assert.Equal(t, "report_confirmation", msg.EventType)
	}
	return out.Data.TicketCode
}

func TestAdminReportAuthGuard(t *testing.T) {
	_, _, app, _, _ := setupAdminReportTestEnv(t, nil)

	id := uuid.NewString()
	for _, tc := range []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/admin/reports"},
		{"GET", "/api/v1/admin/reports/" + id},
		{"PATCH", "/api/v1/admin/reports/" + id + "/status"},
		{"PATCH", "/api/v1/admin/reports/" + id + "/notes"},
		{"GET", "/api/v1/admin/reports/" + id + "/files/ktm_krs"},
	} {
		resp, _ := doJSONRequest(t, app, tc.method, tc.path, nil, nil)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode, "%s %s must require JWT", tc.method, tc.path)
	}
}

func TestAdminReportListFilterStatsAndDataMinimization(t *testing.T) {
	cfg, db, app, spy, _ := setupAdminReportTestEnv(t, nil)

	var createdTickets []string
	t.Cleanup(func() {
		if len(createdTickets) > 0 {
			_ = db.Where("ticket_code IN ?", createdTickets).Delete(&models.Report{}).Error
		}
	})

	uniqueTag := uuid.NewString()[:8]
	fields1 := defaultReportFormFields()
	fields1["reporter_name"] = "Pelapor Satu " + uniqueTag
	fields1["npm"] = "51420001"
	fields1["secret_traits"] = "SUPER-SECRET-TRAIT-ONE"
	ticket1 := submitSampleReport(t, app, spy, fields1, false)
	createdTickets = append(createdTickets, ticket1)

	fields2 := defaultReportFormFields()
	fields2["reporter_name"] = "Pelapor Dua " + uniqueTag
	fields2["npm"] = "51420002"
	fields2["secret_traits"] = "SUPER-SECRET-TRAIT-TWO"
	ticket2 := submitSampleReport(t, app, spy, fields2, true)
	createdTickets = append(createdTickets, ticket2)

	// Mark ticket2 as Perlu Verifikasi + stale for filter & stats verification
	require.NoError(t, db.Model(&models.Report{}).Where("ticket_code = ?", ticket2).Updates(map[string]interface{}{
		"status":   models.ReportStatusPerluVerifikasi,
		"is_stale": true,
	}).Error)

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	today := time.Now().Format("2006-01-02")

	// 1. Filter by search + date range + is_stale
	resp, body := doJSONRequest(
		t,
		app,
		"GET",
		fmt.Sprintf("/api/v1/admin/reports?search=%s&is_stale=true&date_from=%s&date_to=%s&sort=ticket_code&order=asc", uniqueTag, today, today),
		nil,
		authHeaders,
	)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	// List must NOT expose secret_traits or internal file paths
	bodyStr := string(body)
	assert.NotContains(t, bodyStr, "secret_traits")
	assert.NotContains(t, bodyStr, "SUPER-SECRET-TRAIT-ONE")
	assert.NotContains(t, bodyStr, "SUPER-SECRET-TRAIT-TWO")
	assert.NotContains(t, bodyStr, "ktm_krs_path")
	assert.NotContains(t, bodyStr, "item_image_path")

	var listResp struct {
		Data []struct {
			TicketCode   string `json:"ticket_code"`
			Status       string `json:"status"`
			IsStale      bool   `json:"is_stale"`
			HasKtmKrs    bool   `json:"has_ktm_krs"`
			HasItemImage bool   `json:"has_item_image"`
		} `json:"data"`
		Meta struct {
			Total  int64 `json:"total"`
			Counts struct {
				Total           int64 `json:"total"`
				BelumAda        int64 `json:"belum_ada"`
				PerluVerifikasi int64 `json:"perlu_verifikasi"`
				Lawas           int64 `json:"lawas"`
			} `json:"counts"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(body, &listResp))
	assert.Equal(t, int64(1), listResp.Meta.Total)
	require.Len(t, listResp.Data, 1)
	assert.Equal(t, ticket2, listResp.Data[0].TicketCode)
	assert.True(t, listResp.Data[0].HasKtmKrs)
	assert.True(t, listResp.Data[0].HasItemImage)
	assert.GreaterOrEqual(t, listResp.Meta.Counts.BelumAda, int64(1))
	assert.GreaterOrEqual(t, listResp.Meta.Counts.PerluVerifikasi, int64(1))
	assert.GreaterOrEqual(t, listResp.Meta.Counts.Lawas, int64(1))

	// 2. Reject invalid query parameters (status, is_stale, SQLi sort, date_from > date_to) -> 422
	for _, queryPath := range []string{
		"/api/v1/admin/reports?status=Unknown",
		"/api/v1/admin/reports?is_stale=maybe",
		"/api/v1/admin/reports?sort=created_at;DROP+TABLE+reports",
		"/api/v1/admin/reports?date_from=2026-11-25&date_to=2026-11-20",
	} {
		r, _ := doJSONRequest(t, app, "GET", queryPath, nil, authHeaders)
		assert.Equal(t, fiber.StatusUnprocessableEntity, r.StatusCode, "expected 422 for %s", queryPath)
	}
}

func TestAdminReportDetailByUUIDAndTicketCode(t *testing.T) {
	cfg, db, app, spy, _ := setupAdminReportTestEnv(t, nil)

	fields := defaultReportFormFields()
	fields["secret_traits"] = "Detail ciri rahasia unik"
	ticket := submitSampleReport(t, app, spy, fields, true)

	t.Cleanup(func() {
		_ = db.Where("ticket_code = ?", ticket).Delete(&models.Report{}).Error
	})

	var dbReport models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket).First(&dbReport).Error)

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	// Lookup by UUID and by ticket code must return identical data
	for _, identifier := range []string{dbReport.ID.String(), ticket} {
		resp, body := doJSONRequest(t, app, "GET", "/api/v1/admin/reports/"+identifier, nil, authHeaders)
		require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "Detail ciri rahasia unik")
		assert.NotContains(t, bodyStr, dbReport.KtmKrsPath)

		var detailResp struct {
			Data struct {
				ID           uuid.UUID `json:"id"`
				TicketCode   string    `json:"ticket_code"`
				SecretTraits string    `json:"secret_traits"`
				Files        struct {
					HasKtmKrs        bool `json:"has_ktm_krs"`
					HasItemImage     bool `json:"has_item_image"`
					HasHandoverProof bool `json:"has_handover_proof"`
				} `json:"files"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(body, &detailResp))
		assert.Equal(t, dbReport.ID, detailResp.Data.ID)
		assert.Equal(t, ticket, detailResp.Data.TicketCode)
		assert.True(t, detailResp.Data.Files.HasKtmKrs)
		assert.True(t, detailResp.Data.Files.HasItemImage)
		assert.False(t, detailResp.Data.Files.HasHandoverProof)
	}

	// Invalid ID -> 400 INVALID_REPORT_ID
	resp, body := doJSONRequest(t, app, "GET", "/api/v1/admin/reports/bad-id", nil, authHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_REPORT_ID", errEnv.Error.Code)

	// Missing UUID -> 404 REPORT_NOT_FOUND
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/reports/"+uuid.NewString(), nil, authHeaders)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "REPORT_NOT_FOUND", errEnv.Error.Code)
}

func TestAdminReportStatusTransitionsNotesAndEmails(t *testing.T) {
	cfg, db, app, spy, _ := setupAdminReportTestEnv(t, nil)

	var createdTickets []string
	var createdInvIDs []uuid.UUID
	var createdReportIDs []uuid.UUID
	t.Cleanup(func() {
		if len(createdReportIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "reports", createdReportIDs).Delete(&models.AuditLog{}).Error
		}
		if len(createdTickets) > 0 {
			_ = db.Where("ticket_code IN ?", createdTickets).Delete(&models.Report{}).Error
		}
		if len(createdInvIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "inventories", createdInvIDs).Delete(&models.AuditLog{}).Error
			_ = db.Where("id IN ?", createdInvIDs).Delete(&models.Inventory{}).Error
		}
	})

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	// Create 2 inventories: one Tersimpan, one Diambil
	invTersimpan := models.Inventory{
		ItemName:         "Laptop ASUS Vivobook",
		InternalCategory: "Elektronik",
		FoundLocation:    "Lab TI Kampus D",
		FoundDatetime:    time.Now().Add(-2 * time.Hour),
		ItemDetails:      "Laptop warna abu-abu",
		FinderName:       "Asisten Lab",
		FinderContact:    "081200001111",
		Status:           models.InventoryStatusTersimpan,
	}
	invDiambil := models.Inventory{
		ItemName:         "Barang Sudah Diambil",
		InternalCategory: "Elektronik",
		FoundLocation:    "Perpus",
		FoundDatetime:    time.Now().Add(-5 * time.Hour),
		ItemDetails:      "Sudah diserahkan",
		FinderName:       "Staf",
		FinderContact:    "081200002222",
		Status:           models.InventoryStatusDiambil,
	}
	require.NoError(t, db.Create(&invTersimpan).Error)
	require.NoError(t, db.Create(&invDiambil).Error)
	createdInvIDs = append(createdInvIDs, invTersimpan.ID, invDiambil.ID)

	// Submit report 1 (Belum Ada -> notes -> Perlu Verifikasi -> Dibatalkan -> Belum Ada -> Ditolak)
	fields1 := defaultReportFormFields()
	fields1["secret_traits"] = "RAHASIA-TIDAK-BOLEH-KE-EMAIL"
	ticket1 := submitSampleReport(t, app, spy, fields1, false)
	createdTickets = append(createdTickets, ticket1)

	var rep1 models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket1).First(&rep1).Error)
	createdReportIDs = append(createdReportIDs, rep1.ID)

	// Confirmation email must NOT leak secret_traits
	assert.Equal(t, 1, spy.count())

	// 1. Update notes via PATCH /notes -> 200, writes REPORT_NOTES_UPDATED, sends 0 emails
	notesBody, _ := json.Marshal(map[string]string{
		"admin_notes": "INTERNAL-ONLY-NOTE-DO-NOT-EMAIL",
	})
	resp, body := doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/notes", notesBody, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	assert.Equal(t, 1, spy.count())

	var notesAudit models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "REPORT_NOTES_UPDATED", rep1.ID).First(&notesAudit).Error)

	// 2. Reject trying to match Diambil inventory -> 409 INVENTORY_ALREADY_CLAIMED
	badInvPayload, _ := json.Marshal(map[string]string{
		"status":               models.ReportStatusPerluVerifikasi,
		"matched_inventory_id": invDiambil.ID.String(),
	})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", badInvPayload, authHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVENTORY_ALREADY_CLAIMED", errEnv.Error.Code)

	// 3. Belum Ada -> Perlu Verifikasi with valid Tersimpan inventory -> 200 + invitation email
	invitePayload, _ := json.Marshal(map[string]string{
		"status":               models.ReportStatusPerluVerifikasi,
		"matched_inventory_id": invTersimpan.ID.String(),
		"admin_notes":          "INTERNAL-ONLY-NOTE-DO-NOT-EMAIL",
	})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", invitePayload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	var statusUpdateResp struct {
		Data struct {
			Report struct {
				Status             string     `json:"status"`
				MatchedInventoryID *uuid.UUID `json:"matched_inventory_id"`
			} `json:"report"`
			EmailNotification struct {
				Queued    bool   `json:"queued"`
				EventType string `json:"event_type"`
				Recipient string `json:"recipient"`
			} `json:"email_notification"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &statusUpdateResp))
	assert.Equal(t, models.ReportStatusPerluVerifikasi, statusUpdateResp.Data.Report.Status)
	require.NotNil(t, statusUpdateResp.Data.Report.MatchedInventoryID)
	assert.Equal(t, invTersimpan.ID, *statusUpdateResp.Data.Report.MatchedInventoryID)
	assert.True(t, statusUpdateResp.Data.EmailNotification.Queued)
	assert.Equal(t, "verification_invitation", statusUpdateResp.Data.EmailNotification.EventType)

	inviteEmail := spy.waitNextEmail(t)
	assert.Equal(t, "verification_invitation", inviteEmail.EventType)
	assert.Contains(t, inviteEmail.Body, cfg.LoketLocation)
	assert.Contains(t, inviteEmail.Body, cfg.LoketSchedule)
	assert.Contains(t, inviteEmail.Body, "KTM asli")
	assert.NotContains(t, inviteEmail.Body, "RAHASIA-TIDAK-BOLEH-KE-EMAIL")
	assert.NotContains(t, inviteEmail.Body, "INTERNAL-ONLY-NOTE-DO-NOT-EMAIL")

	// 4. Reject direct transition Perlu Verifikasi -> Selesai -> 422 HANDOVER_REQUIRED
	selesaiPayload, _ := json.Marshal(map[string]string{"status": models.ReportStatusSelesai})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", selesaiPayload, authHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "HANDOVER_REQUIRED", errEnv.Error.Code)

	// 5. Transition Perlu Verifikasi -> Dibatalkan -> Belum Ada (clears matched_inventory_id)
	cancelPayload, _ := json.Marshal(map[string]string{"status": models.ReportStatusDibatalkan})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", cancelPayload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	reopenPayload, _ := json.Marshal(map[string]string{"status": models.ReportStatusBelumAda})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", reopenPayload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	var reopened struct {
		Data struct {
			Report struct {
				Status             string     `json:"status"`
				MatchedInventoryID *uuid.UUID `json:"matched_inventory_id"`
			} `json:"report"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &reopened))
	assert.Equal(t, models.ReportStatusBelumAda, reopened.Data.Report.Status)
	assert.Nil(t, reopened.Data.Report.MatchedInventoryID)

	// 6. Reject Ditolak without rejection_reason -> 422 VALIDATION_ERROR
	missingReasonPayload, _ := json.Marshal(map[string]string{"status": models.ReportStatusDitolak, "rejection_reason": "  "})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", missingReasonPayload, authHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "rejection_reason")

	// 7. Belum Ada -> Ditolak with reason -> 200, REPORT_REJECTED audit log, rejection email without admin_notes
	rejectPayload, _ := json.Marshal(map[string]string{
		"status":           models.ReportStatusDitolak,
		"rejection_reason": "Foto KTM/KRS tidak terbaca.",
	})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", rejectPayload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	rejectEmail := spy.waitNextEmail(t)
	assert.Equal(t, "report_rejection", rejectEmail.EventType)
	assert.Contains(t, rejectEmail.Body, "Foto KTM/KRS tidak terbaca.")
	assert.NotContains(t, rejectEmail.Body, "INTERNAL-ONLY-NOTE-DO-NOT-EMAIL")

	var rejectedAudit models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "REPORT_REJECTED", rep1.ID).First(&rejectedAudit).Error)

	// 8. Cannot transition out of Ditolak -> 422 INVALID_STATUS_TRANSITION
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", reopenPayload, authHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_STATUS_TRANSITION", errEnv.Error.Code)

	// 9. Cannot transition out of Selesai -> 409 REPORT_ALREADY_COMPLETED
	require.NoError(t, db.Model(&models.Report{}).Where("id = ?", rep1.ID).Update("status", models.ReportStatusSelesai).Error)
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket1+"/status", cancelPayload, authHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "REPORT_ALREADY_COMPLETED", errEnv.Error.Code)
}

func TestAdminReportPrivateFileStreamingAndSecurity(t *testing.T) {
	cfg, db, app, spy, _ := setupAdminReportTestEnv(t, nil)

	ticketWithBoth := submitSampleReport(t, app, spy, defaultReportFormFields(), true)
	ticketKTMOnly := submitSampleReport(t, app, spy, defaultReportFormFields(), false)

	var repBoth, repKTM models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticketWithBoth).First(&repBoth).Error)
	require.NoError(t, db.Where("ticket_code = ?", ticketKTMOnly).First(&repKTM).Error)

	t.Cleanup(func() {
		_ = db.Where("target_table = ? AND target_id IN ?", "reports", []uuid.UUID{repBoth.ID, repKTM.ID}).Delete(&models.AuditLog{}).Error
		_ = db.Where("id IN ?", []uuid.UUID{repBoth.ID, repKTM.ID}).Delete(&models.Report{}).Error
	})

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	// 1. Stream ktm_krs (and alias ktm) -> 200, exact PNG bytes, defensive headers, audit log created
	for _, fileType := range []string{"ktm_krs", "ktm"} {
		req := httptest.NewRequest("GET", "/api/v1/admin/reports/"+repBoth.ID.String()+"/files/"+fileType, nil)
		req.Header.Set("Authorization", authHeaders["Authorization"])
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		data, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		require.NoError(t, err)

		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		assert.Equal(t, validPNGBytes(), data)
		assert.Equal(t, "image/png", resp.Header.Get("Content-Type"))
		assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
		assert.Equal(t, "no-store, private", resp.Header.Get("Cache-Control"))
		assert.NotEmpty(t, resp.Header.Get("X-File-SHA256"))
		assert.Contains(t, resp.Header.Get("Content-Disposition"), repBoth.TicketCode)
	}

	// Stream item_image -> 200, exact JPEG bytes
	reqImg := httptest.NewRequest("GET", "/api/v1/admin/reports/"+ticketWithBoth+"/files/item_image", nil)
	reqImg.Header.Set("Authorization", authHeaders["Authorization"])
	respImg, err := app.Test(reqImg, -1)
	require.NoError(t, err)
	imgData, err := io.ReadAll(respImg.Body)
	respImg.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respImg.StatusCode)
	assert.Equal(t, validJPEGBytes(), imgData)

	var fileAuditCount int64
	require.NoError(t, db.Model(&models.AuditLog{}).Where("action = ? AND target_id = ?", "REPORT_FILE_ACCESSED", repBoth.ID).Count(&fileAuditCount).Error)
	assert.Equal(t, int64(3), fileAuditCount)

	// 2. Request missing optional file -> 404 FILE_NOT_UPLOADED
	resp, body := doJSONRequest(t, app, "GET", "/api/v1/admin/reports/"+repKTM.ID.String()+"/files/item_image", nil, authHeaders)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "FILE_NOT_UPLOADED", errEnv.Error.Code)

	// 3. Invalid file_type -> 400 INVALID_FILE_TYPE
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/reports/"+repBoth.ID.String()+"/files/secret", nil, authHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_FILE_TYPE", errEnv.Error.Code)

	// 4. Path traversal defense: tampered DB ktm_krs_path = "../../.env" must be rejected with 400 INVALID_FILE_PATH
	require.NoError(t, db.Model(&models.Report{}).Where("id = ?", repKTM.ID).Update("ktm_krs_path", "../../.env").Error)
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/reports/"+repKTM.ID.String()+"/files/ktm_krs", nil, authHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_FILE_PATH", errEnv.Error.Code)
	assert.NotContains(t, string(body), "JWT_SECRET")
}

func TestSMTPFailureDoesNotAbortReportSubmitOrStatusUpdate(t *testing.T) {
	cfg, db, app, spy, _ := setupAdminReportTestEnv(t, errors.New("simulated SMTP dial timeout"))

	// Submit report while SMTP is failing -> STILL returns 201 and saves report!
	status, body := doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "ktm.png", content: validPNGBytes()},
	})
	require.Equal(t, fiber.StatusCreated, status, string(body))

	var submitOut struct {
		Data struct {
			TicketCode string `json:"ticket_code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &submitOut))
	ticket := submitOut.Data.TicketCode
	_ = spy.waitNextEmail(t)

	var rep models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket).First(&rep).Error)
	t.Cleanup(func() {
		_ = db.Where("target_table = ? AND target_id = ?", "reports", rep.ID).Delete(&models.AuditLog{}).Error
		_ = db.Where("id = ?", rep.ID).Delete(&models.Report{}).Error
	})

	// Update status to Perlu Verifikasi while SMTP is failing -> STILL returns 200 and updates status!
	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	payload, _ := json.Marshal(map[string]string{"status": models.ReportStatusPerluVerifikasi})
	resp, updateBody := doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket+"/status", payload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(updateBody))
	_ = spy.waitNextEmail(t)

	var updated models.Report
	require.NoError(t, db.Where("id = ?", rep.ID).First(&updated).Error)
	assert.Equal(t, models.ReportStatusPerluVerifikasi, updated.Status)
}
