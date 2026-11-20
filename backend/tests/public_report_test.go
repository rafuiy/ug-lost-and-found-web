package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"regexp"
	"testing"
	"time"

	"backend/config"
	"backend/models"
	"backend/routes"
	"backend/seeders"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type multipartFileSpec struct {
	fieldName string
	fileName  string
	content   []byte
}

func setupPublicReportTestEnv(t *testing.T) (*config.AppConfig, *gorm.DB, *fiber.App, string) {
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

	app := routes.NewApp(&cfgCopy, routes.AppOptions{
		LoginRateLimitMax:        100,
		LoginRateLimitWindow:     time.Minute,
		ReportSubmitRateLimitMax: 100,
		ReportTrackRateLimitMax:  100,
	})
	return &cfgCopy, db, app, uploadDir
}

func validPNGBytes() []byte {
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE,
	}
}

func validJPEGBytes() []byte {
	return []byte{
		0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
		0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
		0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
	}
}

func validPDFBytes() []byte {
	return []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
}

func defaultReportFormFields() map[string]string {
	return map[string]string{
		"reporter_name":    "Fakhriza Test",
		"reporter_email":   "fakhriza@student.gunadarma.ac.id",
		"npm":              "51421890",
		"phone_number":     "0812-8934-5671",
		"item_name":        "Laptop ASUS Vivobook",
		"loss_location":    "Kampus D Margonda Lab TI Lt. 3",
		"loss_datetime":    time.Now().Add(-3 * time.Hour).Format(time.RFC3339),
		"item_description": "Laptop warna abu-abu gelap tertinggal di meja praktikum.",
		"secret_traits":    "Ada stiker kucing hitam di pojok kiri bawah casing.",
	}
}

func doMultipartReportRequest(t *testing.T, app *fiber.App, fields map[string]string, files []multipartFileSpec) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for k, v := range fields {
		require.NoError(t, writer.WriteField(k, v))
	}
	for _, f := range files {
		part, err := writer.CreateFormFile(f.fieldName, f.fileName)
		require.NoError(t, err)
		_, err = part.Write(f.content)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest("POST", "/api/v1/reports", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, body
}

func countFilesInDir(t *testing.T, dir string) int {
	t.Helper()
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	return len(entries)
}

func TestPublicReportSubmitSuccessAndUploadSecurity(t *testing.T) {
	_, db, app, uploadDir := setupPublicReportTestEnv(t)

	var createdTickets []string
	t.Cleanup(func() {
		if len(createdTickets) > 0 {
			_ = db.Where("ticket_code IN ?", createdTickets).Delete(&models.Report{}).Error
		}
	})

	ticketPattern := regexp.MustCompile(`^UG-[A-HJ-KM-NP-Z2-9]{5}$`)

	// 1. Valid PNG (ktm_krs) + valid JPEG (item_image) -> 201, 2 UUID files saved, no private paths leaked
	status, body := doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "ktm.png", content: validPNGBytes()},
		{fieldName: "item_image", fileName: "laptop.jpg", content: validJPEGBytes()},
	})
	require.Equal(t, fiber.StatusCreated, status, string(body))

	var submitResp1 struct {
		Data struct {
			TicketCode  string `json:"ticket_code"`
			Status      string `json:"status"`
			TrackingURL string `json:"tracking_url"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &submitResp1))
	createdTickets = append(createdTickets, submitResp1.Data.TicketCode)

	assert.Regexp(t, ticketPattern, submitResp1.Data.TicketCode)
	assert.Equal(t, models.ReportStatusBelumAda, submitResp1.Data.Status)
	assert.Equal(t, "/track/"+submitResp1.Data.TicketCode, submitResp1.Data.TrackingURL)
	assert.NotContains(t, string(body), "ktm_krs_path")
	assert.NotContains(t, string(body), "item_image_path")
	assert.NotContains(t, string(body), "secret_traits")
	assert.Equal(t, 2, countFilesInDir(t, uploadDir))

	// Verify phone was normalized and files stored with UUID filenames in DB
	var savedReport1 models.Report
	require.NoError(t, db.Where("ticket_code = ?", submitResp1.Data.TicketCode).First(&savedReport1).Error)
	assert.Equal(t, "081289345671", savedReport1.PhoneNumber)
	assert.Regexp(t, `\.png$`, savedReport1.KtmKrsPath)
	require.NotNil(t, savedReport1.ItemImagePath)
	assert.Regexp(t, `\.jpg$`, *savedReport1.ItemImagePath)

	// 2. Valid PDF (ktm_krs) without optional item_image -> 201, +1 file on disk
	status, body = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "krs.pdf", content: validPDFBytes()},
	})
	require.Equal(t, fiber.StatusCreated, status, string(body))
	var submitResp2 struct {
		Data struct {
			TicketCode string `json:"ticket_code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &submitResp2))
	createdTickets = append(createdTickets, submitResp2.Data.TicketCode)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))

	// 3. Invalid text fields & missing ktm_krs -> 422, 0 new files on disk
	badFields := defaultReportFormFields()
	badFields["reporter_email"] = "not-an-email"
	badFields["npm"] = "abc"
	badFields["phone_number"] = "123"
	badFields["loss_datetime"] = time.Now().Add(2 * time.Hour).Format(time.RFC3339)
	badFields["secret_traits"] = "   "

	status, body = doMultipartReportRequest(t, app, badFields, nil)
	assert.Equal(t, fiber.StatusUnprocessableEntity, status)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "reporter_email")
	assert.Contains(t, errEnv.Error.Fields, "npm")
	assert.Contains(t, errEnv.Error.Fields, "phone_number")
	assert.Contains(t, errEnv.Error.Fields, "loss_datetime")
	assert.Contains(t, errEnv.Error.Fields, "secret_traits")
	assert.Contains(t, errEnv.Error.Fields, "ktm_krs")
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))

	// 4. Spoofed HTML disguised as .jpg -> 415 UNSUPPORTED_MEDIA_TYPE, 0 orphan files
	status, body = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "evil.jpg", content: []byte("<html><script>alert(1)</script></html>")},
	})
	assert.Equal(t, fiber.StatusUnsupportedMediaType, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "UNSUPPORTED_MEDIA_TYPE", errEnv.Error.Code)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))

	// 5. Spoofed SVG disguised as .png -> 415 UNSUPPORTED_MEDIA_TYPE, 0 orphan files
	status, _ = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "vector.png", content: []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)},
	})
	assert.Equal(t, fiber.StatusUnsupportedMediaType, status)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))

	// 6. PNG bytes with .pdf extension (MIME mismatch) -> 415 MIME_MISMATCH, 0 orphan files
	status, body = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "fake.pdf", content: validPNGBytes()},
	})
	assert.Equal(t, fiber.StatusUnsupportedMediaType, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "MIME_MISMATCH", errEnv.Error.Code)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))

	// 7. Valid ktm_krs + invalid item_image MUST clean up ktm_krs (0 orphan files left!)
	status, _ = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "ktm.png", content: validPNGBytes()},
		{fieldName: "item_image", fileName: "xss.jpg", content: []byte("<html>bad</html>")},
	})
	assert.Equal(t, fiber.StatusUnsupportedMediaType, status)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir), "ktm_krs file must be cleaned up when item_image validation fails")

	// 8. Oversized file (> 2 MB) -> 413 FILE_TOO_LARGE, 0 orphan files
	oversized := append(validPNGBytes(), bytes.Repeat([]byte("A"), 2*1024*1024+100)...)
	status, body = doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "huge.png", content: oversized},
	})
	assert.Equal(t, fiber.StatusRequestEntityTooLarge, status)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "FILE_TOO_LARGE", errEnv.Error.Code)
	assert.Equal(t, 3, countFilesInDir(t, uploadDir))
}

func TestPublicReportTrackingAntiIDORAndDataMinimization(t *testing.T) {
	cfg, db, app, _ := setupPublicReportTestEnv(t)

	var createdTickets []string
	t.Cleanup(func() {
		if len(createdTickets) > 0 {
			_ = db.Where("ticket_code IN ?", createdTickets).Delete(&models.Report{}).Error
		}
	})

	// Create report via public submit endpoint
	status, body := doMultipartReportRequest(t, app, defaultReportFormFields(), []multipartFileSpec{
		{fieldName: "ktm_krs", fileName: "ktm.png", content: validPNGBytes()},
	})
	require.Equal(t, fiber.StatusCreated, status, string(body))

	var submitResp struct {
		Data struct {
			TicketCode string `json:"ticket_code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(body, &submitResp))
	ticketCode := submitResp.Data.TicketCode
	createdTickets = append(createdTickets, ticketCode)

	// Set private admin_notes to verify it NEVER leaks in tracking responses
	secretAdminNote := "INTERNAL-ADMIN-NOTE-CONFIDENTIAL"
	require.NoError(t, db.Model(&models.Report{}).Where("ticket_code = ?", ticketCode).Update("admin_notes", secretAdminNote).Error)

	// 1. Track with last 4 digits of NPM ("1890") -> 200, strictly public fields ONLY
	trackNPM, _ := json.Marshal(map[string]string{
		"ticket_code":       ticketCode,
		"verification_code": "1890",
	})
	resp, trackBody := doJSONRequest(t, app, "POST", "/api/v1/reports/track", trackNPM, nil)
	require.Equal(t, fiber.StatusOK, resp.StatusCode, string(trackBody))

	trackStr := string(trackBody)
	for _, forbidden := range []string{
		"secret_traits",
		"ktm_krs",
		"item_image",
		"admin_notes",
		secretAdminNote,
		"51421890",
		"081289345671",
		"fakhriza@student.gunadarma.ac.id",
		"Fakhriza Test",
		"stiker kucing hitam",
	} {
		assert.NotContains(t, trackStr, forbidden, "tracking response must not leak %q", forbidden)
	}

	// 2. Track with last 4 digits of Phone ("5671") -> 200
	trackPhone, _ := json.Marshal(map[string]string{
		"ticket_code":       ticketCode,
		"verification_code": "5671",
	})
	resp, _ = doJSONRequest(t, app, "POST", "/api/v1/reports/track", trackPhone, nil)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// 3. Perlu Verifikasi -> includes visit location, schedule, and KTM instruction
	require.NoError(t, db.Model(&models.Report{}).Where("ticket_code = ?", ticketCode).Update("status", models.ReportStatusPerluVerifikasi).Error)
	resp, trackBody = doJSONRequest(t, app, "POST", "/api/v1/reports/track", trackNPM, nil)
	require.Equal(t, fiber.StatusOK, resp.StatusCode)
	var visitEnvelope struct {
		Data struct {
			Status string `json:"status"`
			Visit  *struct {
				Location         string `json:"location"`
				Schedule         string `json:"schedule"`
				RequiredDocument string `json:"required_document"`
			} `json:"visit"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(trackBody, &visitEnvelope))
	assert.Equal(t, models.ReportStatusPerluVerifikasi, visitEnvelope.Data.Status)
	require.NotNil(t, visitEnvelope.Data.Visit)
	assert.Equal(t, cfg.LoketLocation, visitEnvelope.Data.Visit.Location)
	assert.Equal(t, cfg.LoketSchedule, visitEnvelope.Data.Visit.Schedule)
	assert.Contains(t, visitEnvelope.Data.Visit.RequiredDocument, "KTM asli")

	// 4. Ditolak -> includes public_reason, still NEVER leaks admin_notes
	publicReason := "Foto KTM/KRS buram dan tidak terbaca."
	require.NoError(t, db.Model(&models.Report{}).Where("ticket_code = ?", ticketCode).Updates(map[string]interface{}{
		"status":           models.ReportStatusDitolak,
		"rejection_reason": publicReason,
	}).Error)
	resp, trackBody = doJSONRequest(t, app, "POST", "/api/v1/reports/track", trackNPM, nil)
	require.Equal(t, fiber.StatusOK, resp.StatusCode)
	assert.Contains(t, string(trackBody), publicReason)
	assert.NotContains(t, string(trackBody), secretAdminNote)

	// 5. Anti-IDOR: wrong verification_code vs non-existent ticket must return IDENTICAL 404 status & message
	wrongCodePayload, _ := json.Marshal(map[string]string{
		"ticket_code":       ticketCode,
		"verification_code": "9999",
	})
	respWrong, bodyWrong := doJSONRequest(t, app, "POST", "/api/v1/reports/track", wrongCodePayload, nil)

	missingTicketPayload, _ := json.Marshal(map[string]string{
		"ticket_code":       "UG-ZZZZZ",
		"verification_code": "1890",
	})
	respMissing, bodyMissing := doJSONRequest(t, app, "POST", "/api/v1/reports/track", missingTicketPayload, nil)

	assert.Equal(t, fiber.StatusNotFound, respWrong.StatusCode)
	assert.Equal(t, fiber.StatusNotFound, respMissing.StatusCode)
	assert.Equal(t, string(bodyWrong), string(bodyMissing), "anti-IDOR error response must be identical")

	// 6. Invalid 4-digit format -> 422 VALIDATION_ERROR
	badFormatPayload, _ := json.Marshal(map[string]string{
		"ticket_code":       ticketCode,
		"verification_code": "12ab",
	})
	resp, body = doJSONRequest(t, app, "POST", "/api/v1/reports/track", badFormatPayload, nil)
	assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)
	var errEnv apiErrorEnvelope
	require.NoError(t, json.Unmarshal(body, &errEnv))
	assert.Equal(t, "VALIDATION_ERROR", errEnv.Error.Code)
	assert.Contains(t, errEnv.Error.Fields, "verification_code")

	// 7. Dedicated rate-limit test on /reports/track -> 429 TRACK_RATE_LIMITED
	rateLimitedApp := routes.NewApp(cfg, routes.AppOptions{
		ReportTrackRateLimitMax:    3,
		ReportTrackRateLimitWindow: 10 * time.Second,
	})
	for i := 0; i < 3; i++ {
		r, _ := doJSONRequest(t, rateLimitedApp, "POST", "/api/v1/reports/track", wrongCodePayload, nil)
		assert.Equal(t, fiber.StatusNotFound, r.StatusCode)
	}
	r4, body4 := doJSONRequest(t, rateLimitedApp, "POST", "/api/v1/reports/track", wrongCodePayload, nil)
	assert.Equal(t, fiber.StatusTooManyRequests, r4.StatusCode)
	errEnv = apiErrorEnvelope{}
	require.NoError(t, json.Unmarshal(body4, &errEnv))
	assert.Equal(t, "TRACK_RATE_LIMITED", errEnv.Error.Code)
}
