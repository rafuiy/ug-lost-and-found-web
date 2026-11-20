package tests

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"testing"
	"time"

	"backend/config"
	"backend/models"
	"backend/routes"
	"backend/seeders"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupHandoverAuditTestEnv(t *testing.T, beforeCommit func(tx *gorm.DB) error) (*config.AppConfig, *gorm.DB, *fiber.App, *spyEmailSender, string) {
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

	spy := newSpyEmailSender(nil)
	app := routes.NewApp(&cfgCopy, routes.AppOptions{
		LoginRateLimitMax:        100,
		LoginRateLimitWindow:     time.Minute,
		ReportSubmitRateLimitMax: 100,
		ReportTrackRateLimitMax:  100,
		EmailSender:              spy,
		HandoverBeforeCommit:     beforeCommit,
	})
	return &cfgCopy, db, app, spy, uploadDir
}

func doMultipartHandoverRequest(
	t *testing.T,
	app *fiber.App,
	fields map[string]string,
	proofFile *multipartFileSpec,
	headers map[string]string,
) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for k, v := range fields {
		require.NoError(t, writer.WriteField(k, v))
	}
	if proofFile != nil {
		part, err := writer.CreateFormFile(proofFile.fieldName, proofFile.fileName)
		require.NoError(t, err)
		_, err = part.Write(proofFile.content)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest("POST", "/api/v1/admin/handovers", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, body
}

func TestHandoverAuthAndValidation(t *testing.T) {
	cfg, _, app, _, uploadDir := setupHandoverAuditTestEnv(t, nil)

	// 1. Unauthenticated -> 401
	resp, _ := doJSONRequest(t, app, "POST", "/api/v1/admin/handovers", nil, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	// 2. Non-multipart JSON body -> 400 INVALID_MULTIPART
	resp, body := doJSONRequest(t, app, "POST", "/api/v1/admin/handovers", []byte(`{"report_id":"UG-12345"}`), authHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_MULTIPART", errEnv.Error.Code)

	// 3. Missing/invalid fields + ktm_verified=false + missing handover_proof -> 422, 0 files on disk
	status, body := doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":              "invalid-id",
			"inventory_id":           "not-a-uuid",
			"recipient_name":         "",
			"recipient_npm":          "123",
			"ktm_verified":           "false",
			"secret_traits_verified": "false",
		},
		nil,
		authHeaders,
	)
	assert.Equal(t, fiber.StatusUnprocessableEntity, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "report_id")
	assert.Contains(t, errEnv.Error.Fields, "inventory_id")
	assert.Contains(t, errEnv.Error.Fields, "recipient_name")
	assert.Contains(t, errEnv.Error.Fields, "recipient_npm")
	assert.Contains(t, errEnv.Error.Fields, "ktm_verified")
	assert.Contains(t, errEnv.Error.Fields, "secret_traits_verified")
	assert.Contains(t, errEnv.Error.Fields, "handover_proof")
	assert.Equal(t, 0, countFilesInDir(t, uploadDir))

	// 4. Spoofed HTML disguised as .jpg -> 415 UNSUPPORTED_MEDIA_TYPE, 0 files on disk
	status, body = doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":      uuid.NewString(),
			"inventory_id":   uuid.NewString(),
			"recipient_name": "Penerima Uji",
			"recipient_npm":  "51421890",
		},
		&multipartFileSpec{
			fieldName: "handover_proof",
			fileName:  "proof.jpg",
			content:   []byte("<html><script>alert(1)</script></html>"),
		},
		authHeaders,
	)
	assert.Equal(t, fiber.StatusUnsupportedMediaType, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "UNSUPPORTED_MEDIA_TYPE", errEnv.Error.Code)
	assert.Equal(t, 0, countFilesInDir(t, uploadDir))
}

func TestHandoverPrerequisitesSuccessAndPrivateProofStream(t *testing.T) {
	cfg, db, app, spy, uploadDir := setupHandoverAuditTestEnv(t, nil)

	var handoverIDs []uuid.UUID
	var reportIDs []uuid.UUID
	var invIDs []uuid.UUID

	t.Cleanup(func() {
		if len(handoverIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "handovers", handoverIDs).Delete(&models.AuditLog{}).Error
			_ = db.Where("id IN ?", handoverIDs).Delete(&models.Handover{}).Error
		}
		if len(reportIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "reports", reportIDs).Delete(&models.AuditLog{}).Error
			_ = db.Where("id IN ?", reportIDs).Delete(&models.Report{}).Error
		}
		if len(invIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "inventories", invIDs).Delete(&models.AuditLog{}).Error
			_ = db.Where("id IN ?", invIDs).Delete(&models.Inventory{}).Error
		}
	})

	ticket := submitSampleReport(t, app, spy, defaultReportFormFields(), false)
	var rep models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket).First(&rep).Error)
	reportIDs = append(reportIDs, rep.ID)

	invTersimpan := models.Inventory{
		ItemName:         "Laptop ASUS Handover",
		InternalCategory: "Elektronik",
		FoundLocation:    "Lab TI",
		FoundDatetime:    time.Now().Add(-3 * time.Hour),
		ItemDetails:      "Laptop warna abu-abu",
		FinderName:       "Hendra",
		FinderContact:    "081200001111",
		Status:           models.InventoryStatusTersimpan,
	}
	invDiambil := models.Inventory{
		ItemName:         "Inventori Sudah Diambil",
		InternalCategory: "Elektronik",
		FoundLocation:    "Perpus",
		FoundDatetime:    time.Now().Add(-4 * time.Hour),
		ItemDetails:      "Sudah diambil",
		FinderName:       "Staf",
		FinderContact:    "081200002222",
		Status:           models.InventoryStatusDiambil,
	}
	require.NoError(t, db.Create(&invTersimpan).Error)
	require.NoError(t, db.Create(&invDiambil).Error)
	invIDs = append(invIDs, invTersimpan.ID, invDiambil.ID)

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	filesBefore := countFilesInDir(t, uploadDir)

	// 1. Report still Belum Ada -> 409 INVALID_REPORT_STATUS + 0 orphan proof files
	status, body := doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":      ticket,
			"inventory_id":   invTersimpan.ID.String(),
			"recipient_name": "Fakhriza Test",
			"recipient_npm":  "51421890",
		},
		&multipartFileSpec{fieldName: "handover_proof", fileName: "proof.jpg", content: validJPEGBytes()},
		authHeaders,
	)
	assert.Equal(t, fiber.StatusConflict, status)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_REPORT_STATUS", errEnv.Error.Code)
	assert.Equal(t, filesBefore, countFilesInDir(t, uploadDir))

	// Move report to Perlu Verifikasi
	statusPayload, _ := json.Marshal(map[string]string{
		"status":               models.ReportStatusPerluVerifikasi,
		"matched_inventory_id": invTersimpan.ID.String(),
	})
	resp, _ := doJSONRequest(t, app, "PATCH", "/api/v1/admin/reports/"+ticket+"/status", statusPayload, authHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode)
	_ = spy.waitNextEmail(t)

	// 2. Inventory is Diambil -> 409 INVENTORY_ALREADY_CLAIMED + 0 orphan proof files
	status, body = doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":      ticket,
			"inventory_id":   invDiambil.ID.String(),
			"recipient_name": "Fakhriza Test",
			"recipient_npm":  "51421890",
		},
		&multipartFileSpec{fieldName: "handover_proof", fileName: "proof.jpg", content: validJPEGBytes()},
		authHeaders,
	)
	assert.Equal(t, fiber.StatusConflict, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVENTORY_ALREADY_CLAIMED", errEnv.Error.Code)
	assert.Equal(t, filesBefore, countFilesInDir(t, uploadDir))

	// 3. Valid handover -> 201 Created, updates report + inventory + writes audit log
	proofBytes := validJPEGBytes()
	expectedSum := sha256.Sum256(proofBytes)
	expectedSHA256 := hex.EncodeToString(expectedSum[:])

	status, body = doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":              ticket,
			"inventory_id":           invTersimpan.ID.String(),
			"recipient_name":         "Fakhriza Test",
			"recipient_npm":          "51421890",
			"handover_notes":         "Diserahkan lengkap di Loket D.",
			"ktm_verified":           "true",
			"secret_traits_verified": "true",
		},
		&multipartFileSpec{fieldName: "handover_proof", fileName: "proof.jpg", content: proofBytes},
		authHeaders,
	)
	require.Equal(t, fiber.StatusCreated, status, string(body))

	assert.NotContains(t, string(body), "handover_proof_path")
	var handoverResp struct {
		Data struct {
			Handover struct {
				ID               uuid.UUID `json:"id"`
				ReportID         uuid.UUID `json:"report_id"`
				TicketCode       string    `json:"ticket_code"`
				InventoryID      uuid.UUID `json:"inventory_id"`
				HasHandoverProof bool      `json:"has_handover_proof"`
				ProofSHA256      string    `json:"proof_sha256"`
			} `json:"handover"`
			ReportStatus    string `json:"report_status"`
			InventoryStatus string `json:"inventory_status"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &handoverResp))
	handoverIDs = append(handoverIDs, handoverResp.Data.Handover.ID)

	assert.Equal(t, rep.ID, handoverResp.Data.Handover.ReportID)
	assert.Equal(t, ticket, handoverResp.Data.Handover.TicketCode)
	assert.Equal(t, invTersimpan.ID, handoverResp.Data.Handover.InventoryID)
	assert.True(t, handoverResp.Data.Handover.HasHandoverProof)
	assert.Equal(t, expectedSHA256, handoverResp.Data.Handover.ProofSHA256)
	assert.Equal(t, models.ReportStatusSelesai, handoverResp.Data.ReportStatus)
	assert.Equal(t, models.InventoryStatusDiambil, handoverResp.Data.InventoryStatus)
	assert.Equal(t, filesBefore+1, countFilesInDir(t, uploadDir))

	// Check DB states directly
	var updatedRep models.Report
	require.NoError(t, db.Where("id = ?", rep.ID).First(&updatedRep).Error)
	assert.Equal(t, models.ReportStatusSelesai, updatedRep.Status)

	var updatedInv models.Inventory
	require.NoError(t, db.Where("id = ?", invTersimpan.ID).First(&updatedInv).Error)
	assert.Equal(t, models.InventoryStatusDiambil, updatedInv.Status)

	var handoverAudit models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "HANDOVER_COMPLETED", handoverResp.Data.Handover.ID).First(&handoverAudit).Error)

	// 4. Stream handover_proof via private file endpoint -> 200 + exact bytes & SHA-256 header
	reqProof := httptest.NewRequest("GET", "/api/v1/admin/reports/"+ticket+"/files/handover_proof", nil)
	reqProof.Header.Set("Authorization", authHeaders["Authorization"])
	respProof, err := app.Test(reqProof, -1)
	require.NoError(t, err)
	streamedBytes, err := io.ReadAll(respProof.Body)
	respProof.Body.Close()
	require.NoError(t, err)

	assert.Equal(t, fiber.StatusOK, respProof.StatusCode)
	assert.Equal(t, proofBytes, streamedBytes)
	assert.Equal(t, expectedSHA256, respProof.Header.Get("X-File-SHA256"))
	assert.Equal(t, "nosniff", respProof.Header.Get("X-Content-Type-Options"))
	assert.Equal(t, "no-store, private", respProof.Header.Get("Cache-Control"))

	// 5. Second handover attempt on same report -> 409 + 0 orphan proof files
	status, _ = doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":      ticket,
			"inventory_id":   invTersimpan.ID.String(),
			"recipient_name": "Fakhriza Test",
			"recipient_npm":  "51421890",
		},
		&multipartFileSpec{fieldName: "handover_proof", fileName: "proof2.jpg", content: proofBytes},
		authHeaders,
	)
	assert.Equal(t, fiber.StatusConflict, status)
	assert.Equal(t, filesBefore+1, countFilesInDir(t, uploadDir))
}

func TestHandoverTransactionRollbackAtomicity(t *testing.T) {
	cfg, db, app, spy, uploadDir := setupHandoverAuditTestEnv(t, func(_ *gorm.DB) error {
		return errors.New("simulated mid-transaction failure")
	})

	ticket := submitSampleReport(t, app, spy, defaultReportFormFields(), false)
	var rep models.Report
	require.NoError(t, db.Where("ticket_code = ?", ticket).First(&rep).Error)

	inv := models.Inventory{
		ItemName:         "Rollback Test Item",
		InternalCategory: "Elektronik",
		FoundLocation:    "Loket D",
		FoundDatetime:    time.Now().Add(-2 * time.Hour),
		ItemDetails:      "Test atomicity",
		FinderName:       "Petugas",
		FinderContact:    "081234560000",
		Status:           models.InventoryStatusTersimpan,
	}
	require.NoError(t, db.Create(&inv).Error)

	t.Cleanup(func() {
		_ = db.Where("report_id = ?", rep.ID).Delete(&models.Handover{}).Error
		_ = db.Where("target_table = ? AND target_id = ?", "reports", rep.ID).Delete(&models.AuditLog{}).Error
		_ = db.Where("id = ?", rep.ID).Delete(&models.Report{}).Error
		_ = db.Where("id = ?", inv.ID).Delete(&models.Inventory{}).Error
	})

	require.NoError(t, db.Model(&models.Report{}).Where("id = ?", rep.ID).Update("status", models.ReportStatusPerluVerifikasi).Error)

	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	authHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	filesBefore := countFilesInDir(t, uploadDir)

	status, body := doMultipartHandoverRequest(
		t,
		app,
		map[string]string{
			"report_id":      ticket,
			"inventory_id":   inv.ID.String(),
			"recipient_name": "Fakhriza Test",
			"recipient_npm":  "51421890",
		},
		&multipartFileSpec{fieldName: "handover_proof", fileName: "proof.jpg", content: validJPEGBytes()},
		authHeaders,
	)
	assert.Equal(t, fiber.StatusInternalServerError, status)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "HANDOVER_FAILED", errEnv.Error.Code)

	// Verify 100% rollback across handovers, reports, inventories, audit_logs, and disk
	var hCount int64
	require.NoError(t, db.Model(&models.Handover{}).Where("report_id = ?", rep.ID).Count(&hCount).Error)
	assert.Equal(t, int64(0), hCount)

	var repAfter models.Report
	require.NoError(t, db.Where("id = ?", rep.ID).First(&repAfter).Error)
	assert.Equal(t, models.ReportStatusPerluVerifikasi, repAfter.Status)

	var invAfter models.Inventory
	require.NoError(t, db.Where("id = ?", inv.ID).First(&invAfter).Error)
	assert.Equal(t, models.InventoryStatusTersimpan, invAfter.Status)

	var auditCount int64
	require.NoError(t, db.Model(&models.AuditLog{}).Where("action = ? AND payload->>'ticket_code' = ?", "HANDOVER_COMPLETED", ticket).Count(&auditCount).Error)
	assert.Equal(t, int64(0), auditCount)

	assert.Equal(t, filesBefore, countFilesInDir(t, uploadDir), "proof file must be removed when transaction rolls back")
}

func TestAuditLogRBACReadOnlyAndFiltering(t *testing.T) {
	cfg, db, app, _, _ := setupHandoverAuditTestEnv(t, nil)

	// Insert a system audit log (AdminID = nil) and clean up in t.Cleanup
	sysTargetID := uuid.New()
	sysLog := models.AuditLog{
		AdminID:     nil,
		Action:      "SYSTEM_TEST_MARKER",
		TargetTable: "reports",
		TargetID:    sysTargetID,
		Payload:     []byte(`{"marker":"audit_test"}`),
	}
	require.NoError(t, db.Create(&sysLog).Error)
	t.Cleanup(func() {
		_ = db.Where("id = ?", sysLog.ID).Delete(&models.AuditLog{}).Error
	})

	// 1. Unauthenticated -> 401
	resp, _ := doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs", nil, nil)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	// 2. Petugas Loket -> 403 FORBIDDEN on list and detail
	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)
	petugasHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	resp, body := doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs", nil, petugasHeaders)
	assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "FORBIDDEN", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Message, "Petugas Loket")
	assert.Contains(t, errEnv.Error.Message, "audit_logs.read")

	resp, _ = doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs/"+sysLog.ID.String(), nil, petugasHeaders)
	assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)

	// 3. Admin -> 200 with filters (action, target_table, admin_id=system, target_id, date range, search)
	adminLogin := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	adminHeaders := map[string]string{"Authorization": "Bearer " + adminLogin.Data.AccessToken}

	today := time.Now().Format("2006-01-02")
	filterPath := fmt.Sprintf(
		"/api/v1/admin/audit-logs?action=SYSTEM_TEST_MARKER&target_table=reports&admin_id=system&target_id=%s&date_from=%s&date_to=%s&search=SYSTEM_TEST_MARKER",
		sysTargetID.String(), today, today,
	)
	resp, body = doJSONRequest(t, app, "GET", filterPath, nil, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	assert.NotContains(t, string(body), "password_hash")

	var listResp struct {
		Data []struct {
			ID          uuid.UUID  `json:"id"`
			AdminID     *uuid.UUID `json:"admin_id"`
			ActorName   string     `json:"actor_name"`
			Action      string     `json:"action"`
			TargetTable string     `json:"target_table"`
			TargetID    uuid.UUID  `json:"target_id"`
		} `json:"data"`
		Meta struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(body, &listResp))
	assert.Equal(t, int64(1), listResp.Meta.Total)
	require.Len(t, listResp.Data, 1)
	assert.Equal(t, sysLog.ID, listResp.Data[0].ID)
	assert.Nil(t, listResp.Data[0].AdminID)
	assert.Equal(t, "SYSTEM", listResp.Data[0].ActorName)

	// Also verify search joined with admins table works cleanly without SQL ambiguity
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs?search=Administrator&action=AUTH_LOGIN_SUCCESS", nil, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	// 4. GetByID: 200 valid, 400 invalid UUID, 404 not found
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs/"+sysLog.ID.String(), nil, adminHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs/not-a-uuid", nil, adminHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_UUID", errEnv.Error.Code)

	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/audit-logs/"+uuid.NewString(), nil, adminHeaders)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "AUDIT_LOG_NOT_FOUND", errEnv.Error.Code)

	// 5. Reject invalid target_table, SQLi sort, date_from > date_to -> 422
	for _, badPath := range []string{
		"/api/v1/admin/audit-logs?target_table=users",
		"/api/v1/admin/audit-logs?sort=created_at;DROP+TABLE+audit_logs",
		"/api/v1/admin/audit-logs?date_from=2026-11-25&date_to=2026-11-20",
	} {
		r, _ := doJSONRequest(t, app, "GET", badPath, nil, adminHeaders)
		assert.Equal(t, fiber.StatusUnprocessableEntity, r.StatusCode, "expected 422 for %s", badPath)
	}

	// 6. Immutability: PUT, PATCH, DELETE must be disallowed and entry stays intact
	for _, method := range []string{"PUT", "PATCH", "DELETE"} {
		r, _ := doJSONRequest(t, app, method, "/api/v1/admin/audit-logs/"+sysLog.ID.String(), []byte(`{}`), adminHeaders)
		assert.Contains(t, []int{fiber.StatusMethodNotAllowed, fiber.StatusNotFound}, r.StatusCode, "%s must not modify audit logs", method)
	}

	var checkCount int64
	require.NoError(t, db.Model(&models.AuditLog{}).Where("id = ?", sysLog.ID).Count(&checkCount).Error)
	assert.Equal(t, int64(1), checkCount)
}
