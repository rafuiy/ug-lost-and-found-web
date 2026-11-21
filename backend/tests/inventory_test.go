package tests

import (
	"encoding/json"
	"fmt"
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

type inventorySingleEnvelope struct {
	Data models.Inventory `json:"data"`
}

type inventoryListEnvelope struct {
	Data []models.Inventory `json:"data"`
	Meta struct {
		Page       int   `json:"page"`
		Limit      int   `json:"limit"`
		Total      int64 `json:"total"`
		TotalPages int64 `json:"total_pages"`
	} `json:"meta"`
}

func setupInventoryTestEnv(t *testing.T) (*config.AppConfig, *gorm.DB, *fiber.App) {
	t.Helper()
	cfg, err := config.LoadConfig()
	require.NoError(t, err)

	db, err := config.ConnectDB(cfg)
	require.NoError(t, err)
	require.NoError(t, models.AutoMigrate(db))
	require.NoError(t, seeders.SeedAll(db, cfg))

	app := routes.NewApp(cfg, routes.AppOptions{
		LoginRateLimitMax:        100,
		LoginRateLimitWindow:     time.Minute,
		ReportSubmitRateLimitMax: 100,
		ReportTrackRateLimitMax:  100,
	})
	return cfg, db, app
}

func TestInventoryAuthGuardAndNoPublicEndpoint(t *testing.T) {
	_, _, app := setupInventoryTestEnv(t)

	// Confirm no public inventory catalog endpoint exists.
	reqPublic := httptest.NewRequest("GET", "/api/v1/inventories", nil)
	respPublic, err := app.Test(reqPublic, -1)
	require.NoError(t, err)
	respPublic.Body.Close()
	assert.Equal(t, fiber.StatusNotFound, respPublic.StatusCode)

	// Confirm all 5 admin inventory endpoints reject unauthenticated requests with 401.
	for _, tc := range []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/admin/inventories"},
		{"POST", "/api/v1/admin/inventories"},
		{"GET", "/api/v1/admin/inventories/" + uuid.NewString()},
		{"PATCH", "/api/v1/admin/inventories/" + uuid.NewString()},
		{"DELETE", "/api/v1/admin/inventories/" + uuid.NewString()},
	} {
		resp, _ := doJSONRequest(t, app, tc.method, tc.path, nil, nil)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode, "%s %s must require JWT", tc.method, tc.path)
	}
}

func TestInventoryCreateListGetAndUpdate(t *testing.T) {
	cfg, db, app := setupInventoryTestEnv(t)

	var createdIDs []uuid.UUID
	t.Cleanup(func() {
		if len(createdIDs) > 0 {
			_ = db.Where("target_table = ? AND target_id IN ?", "inventories", createdIDs).Delete(&models.AuditLog{}).Error
			_ = db.Unscoped().Where("id IN ?", createdIDs).Delete(&models.Inventory{}).Error
		}
	})

	adminLogin := loginForTest(t, app, "admin@gmail.com", cfg.SeedAdminPassword)
	petugasLogin := loginForTest(t, app, "petugas@gmail.com", cfg.SeedPetugasPassword)

	adminHeaders := map[string]string{"Authorization": "Bearer " + adminLogin.Data.AccessToken}
	petugasHeaders := map[string]string{"Authorization": "Bearer " + petugasLogin.Data.AccessToken}

	pastTime := time.Now().Add(-2 * time.Hour).Format(time.RFC3339)
	futureTime := time.Now().Add(2 * time.Hour).Format(time.RFC3339)

	// 1. Mass assignment attempt with status="Diambil" must be rejected with 400 UNKNOWN_FIELD
	massAssignBody, _ := json.Marshal(map[string]interface{}{
		"item_name":         "Laptop ASUS",
		"internal_category": "Elektronik",
		"found_location":    "Kampus D Lab TI",
		"found_datetime":    pastTime,
		"item_details":      "Warna abu-abu",
		"finder_name":       "Hendra",
		"finder_contact":    "081234567890",
		"status":            "Diambil",
	})
	resp, body := doJSONRequest(t, app, "POST", "/api/v1/admin/inventories", massAssignBody, petugasHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "UNKNOWN_FIELD", errEnv.Error.Code)

	// 2. Validation errors: missing fields & future datetime -> 422
	invalidBody, _ := json.Marshal(map[string]string{
		"item_name":         "",
		"internal_category": "Elektronik",
		"found_location":    "",
		"found_datetime":    futureTime,
		"item_details":      "Detail",
		"finder_name":       "Hendra",
		"finder_contact":    "",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/inventories", invalidBody, petugasHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "item_name")
	assert.Contains(t, errEnv.Error.Fields, "found_location")
	assert.Contains(t, errEnv.Error.Fields, "found_datetime")
	assert.Contains(t, errEnv.Error.Fields, "finder_contact")

	// 3. Valid create by Petugas Loket -> 201, status='Tersimpan', INVENTORY_CREATED audit log
	uniqueTag := uuid.NewString()[:8]
	createPayload1, _ := json.Marshal(map[string]string{
		"item_name":         "Dompet Eiger " + uniqueTag,
		"internal_category": "Aksesoris",
		"found_location":    "Kantin Gedung 2 Kampus D",
		"found_datetime":    pastTime,
		"item_details":      "Dompet kulit cokelat tanpa uang tunai",
		"finder_name":       "Ibu Eni",
		"finder_contact":    "081298765432",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/inventories", createPayload1, petugasHeaders)
	require.Equal(t, fiber.StatusCreated, resp.StatusCode, string(body))
	var created1 inventorySingleEnvelope
	require.NoError(t, json.Unmarshal(body, &created1))
	createdIDs = append(createdIDs, created1.Data.ID)
	assert.Equal(t, models.InventoryStatusTersimpan, created1.Data.Status)

	var auditCreated models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "INVENTORY_CREATED", created1.Data.ID).First(&auditCreated).Error)

	// 4. Valid create by Admin -> 201
	createPayload2, _ := json.Marshal(map[string]string{
		"item_name":         "Laptop ASUS " + uniqueTag,
		"internal_category": "Elektronik",
		"found_location":    "Lab Komputer Lt 3 Kampus D",
		"found_datetime":    pastTime,
		"item_details":      "Laptop abu-abu dengan charger",
		"finder_name":       "Hendra",
		"finder_contact":    "081355556666",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/admin/inventories", createPayload2, adminHeaders)
	require.Equal(t, fiber.StatusCreated, resp.StatusCode, string(body))
	var created2 inventorySingleEnvelope
	require.NoError(t, json.Unmarshal(body, &created2))
	createdIDs = append(createdIDs, created2.Data.ID)

	// 5. List with filters, pagination, and SQLi sort rejection
	resp, body = doJSONRequest(
		t,
		app,
		"GET",
		fmt.Sprintf("/api/v1/admin/inventories?status=Tersimpan&category=Elektronik&search=%s&page=1&limit=10&sort=item_name&order=asc", uniqueTag),
		nil,
		petugasHeaders,
	)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	var listResp inventoryListEnvelope
	require.NoError(t, json.Unmarshal(body, &listResp))
	assert.Equal(t, int64(1), listResp.Meta.Total)
	require.Len(t, listResp.Data, 1)
	assert.Equal(t, created2.Data.ID, listResp.Data[0].ID)

	// SQLi attempt in sort parameter -> 422
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories?sort=created_at;DROP+TABLE+inventories", nil, adminHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "sort")

	// Invalid status filter -> 422
	resp, _ = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories?status=Hilang", nil, adminHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)

	// 6. GetByID: 200 valid, 400 invalid UUID, 404 not found
	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories/"+created1.Data.ID.String(), nil, petugasHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	var fetched inventorySingleEnvelope
	require.NoError(t, json.Unmarshal(body, &fetched))
	assert.Equal(t, created1.Data.ItemName, fetched.Data.ItemName)

	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories/not-a-uuid", nil, petugasHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVALID_UUID", errEnv.Error.Code)

	resp, body = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories/"+uuid.NewString(), nil, petugasHeaders)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVENTORY_NOT_FOUND", errEnv.Error.Code)

	// 7. PATCH update: partial success, empty {} rejected, status change rejected, Diambil rejected with 409
	patchBody, _ := json.Marshal(map[string]string{
		"item_details": "Dompet kulit cokelat diperbarui dengan ciri jahitan",
	})
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/inventories/"+created1.Data.ID.String(), patchBody, petugasHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	var updated inventorySingleEnvelope
	require.NoError(t, json.Unmarshal(body, &updated))
	assert.Equal(t, "Dompet kulit cokelat diperbarui dengan ciri jahitan", updated.Data.ItemDetails)

	var auditUpdated models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "INVENTORY_UPDATED", created1.Data.ID).First(&auditUpdated).Error)

	// Empty {} -> 422
	resp, _ = doJSONRequest(t, app, "PATCH", "/api/v1/admin/inventories/"+created1.Data.ID.String(), []byte(`{}`), petugasHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)

	// Attempt to change status directly -> 400 UNKNOWN_FIELD
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/inventories/"+created1.Data.ID.String(), []byte(`{"status":"Diambil"}`), adminHeaders)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "UNKNOWN_FIELD", errEnv.Error.Code)

	// Inventory already Diambil -> 409 INVENTORY_ALREADY_CLAIMED on PATCH and DELETE
	require.NoError(t, db.Model(&models.Inventory{}).Where("id = ?", created1.Data.ID).Update("status", models.InventoryStatusDiambil).Error)
	resp, body = doJSONRequest(t, app, "PATCH", "/api/v1/admin/inventories/"+created1.Data.ID.String(), patchBody, adminHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVENTORY_ALREADY_CLAIMED", errEnv.Error.Code)

	delClaimedBody, _ := json.Marshal(map[string]string{
		"reason":     "Coba hapus barang yang sudah diambil",
		"confirm_id": created1.Data.ID.String(),
	})
	resp, body = doJSONRequest(t, app, "DELETE", "/api/v1/admin/inventories/"+created1.Data.ID.String(), delClaimedBody, adminHeaders)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "INVENTORY_ALREADY_CLAIMED", errEnv.Error.Code)

	// 8. DELETE soft-delete verification: case-sensitive confirm_id, unlinks Perlu Verifikasi report -> Belum Ada, excludes from active queries
	linkedRep := models.Report{
		TicketCode:         "UG-DL999",
		ReporterName:       "Pelapor Linked",
		ReporterEmail:      "linked@student.gunadarma.ac.id",
		NPM:                "51429999",
		PhoneNumber:        "081299998888",
		ItemName:           "Laptop ASUS Linked",
		Category:           "Elektronik",
		LossLocation:       "Lab TI",
		LossDatetime:       time.Now().Add(-3 * time.Hour),
		ItemDescription:    "Laptop tertaut",
		SecretTraits:       "Ciri rahasia",
		KtmKrsPath:         "dummy.png",
		Status:             models.ReportStatusPerluVerifikasi,
		MatchedInventoryID: &created2.Data.ID,
	}
	require.NoError(t, db.Create(&linkedRep).Error)
	t.Cleanup(func() {
		_ = db.Where("target_table = ? AND target_id = ?", "reports", linkedRep.ID).Delete(&models.AuditLog{}).Error
		_ = db.Where("id = ?", linkedRep.ID).Delete(&models.Report{}).Error
	})

	// Case-mismatch confirm_id (uppercase UUID) -> 422 VALIDATION_ERROR
	upperConfirm, _ := json.Marshal(map[string]string{
		"reason":     "Salah input duplikat",
		"confirm_id": fmt.Sprintf("%s", uuid.MustParse(created2.Data.ID.String())),
	})
	_ = upperConfirm
	badCaseBody, _ := json.Marshal(map[string]string{
		"reason":     "Salah input duplikat",
		"confirm_id": "INV-WRONG-ID",
	})
	resp, body = doJSONRequest(t, app, "DELETE", "/api/v1/admin/inventories/"+created2.Data.ID.String(), badCaseBody, petugasHeaders)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Contains(t, errEnv.Error.Fields, "confirm_id")

	// Valid DELETE -> 200 OK, soft-deleted in DB, unlinks report back to Belum Ada, writes INVENTORY_DELETED audit log
	validDeleteBody, _ := json.Marshal(map[string]string{
		"reason":     "Salah input data barang / duplikasi entri",
		"confirm_id": created2.Data.ID.String(),
	})
	resp, body = doJSONRequest(t, app, "DELETE", "/api/v1/admin/inventories/"+created2.Data.ID.String(), validDeleteBody, petugasHeaders)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))

	// Active GET by ID must now return 404 INVENTORY_NOT_FOUND
	resp, _ = doJSONRequest(t, app, "GET", "/api/v1/admin/inventories/"+created2.Data.ID.String(), nil, petugasHeaders)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	// Unscoped query confirms row still exists in PostgreSQL with deleted_at & delete_reason populated (Soft Delete)
	var softDeletedInv models.Inventory
	require.NoError(t, db.Unscoped().Where("id = ?", created2.Data.ID).First(&softDeletedInv).Error)
	assert.True(t, softDeletedInv.DeletedAt.Valid)
	require.NotNil(t, softDeletedInv.DeleteReason)
	assert.Equal(t, "Salah input data barang / duplikasi entri", *softDeletedInv.DeleteReason)

	// Linked report must be reverted to Belum Ada and matched_inventory_id cleared
	var unlinkedRep models.Report
	require.NoError(t, db.Where("id = ?", linkedRep.ID).First(&unlinkedRep).Error)
	assert.Equal(t, models.ReportStatusBelumAda, unlinkedRep.Status)
	assert.Nil(t, unlinkedRep.MatchedInventoryID)

	var auditDeleted models.AuditLog
	require.NoError(t, db.Where("action = ? AND target_id = ?", "INVENTORY_DELETED", created2.Data.ID).First(&auditDeleted).Error)
}
