package handlers

import (
	"errors"
	"mime/multipart"
	"regexp"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var fourDigitsRegex = regexp.MustCompile(`^\d{4}$`)

type SubmitReportResponse struct {
	TicketCode         string  `json:"ticket_code"`
	Status             string  `json:"status"`
	TrackingURL        string  `json:"tracking_url"`
	Category           string  `json:"category"`
	ReopenedFromTicket *string `json:"reopened_from_ticket,omitempty"`
}

type ReopenReportPrefillResponse struct {
	OriginalTicketCode string    `json:"original_ticket_code"`
	CancelledFrom      string    `json:"cancelled_from"`
	CancelReason       string    `json:"cancel_reason"`
	ReporterName       string    `json:"reporter_name"`
	ReporterEmail      string    `json:"reporter_email"`
	NPM                string    `json:"npm"`
	PhoneNumber        string    `json:"phone_number"`
	ItemName           string    `json:"item_name"`
	Category           string    `json:"category"`
	LossLocation       string    `json:"loss_location"`
	LossDatetime       time.Time `json:"loss_datetime"`
	ItemDescription    string    `json:"item_description"`
}

type TrackReportRequest struct {
	TicketCode       string `json:"ticket_code"`
	VerificationCode string `json:"verification_code"`
}

type TrackVisitInfo struct {
	Location         string `json:"location"`
	Schedule         string `json:"schedule"`
	RequiredDocument string `json:"required_document"`
}

// TrackReportResponse strictly exposes only public, non-sensitive tracking fields.
type TrackReportResponse struct {
	TicketCode   string          `json:"ticket_code"`
	Status       string          `json:"status"`
	IsStale      bool            `json:"is_stale"`
	CreatedAt    time.Time       `json:"created_at"`
	Message      string          `json:"message"`
	Visit        *TrackVisitInfo `json:"visit,omitempty"`
	PublicReason *string         `json:"public_reason,omitempty"`
}

type ReportHandler struct {
	Cfg   *config.AppConfig
	Email services.EmailSender
}

func NewReportHandler(cfg *config.AppConfig, email services.EmailSender) *ReportHandler {
	return &ReportHandler{
		Cfg:   cfg,
		Email: email,
	}
}

// SubmitReport accepts an unauthenticated multipart/form-data lost-item report with private file uploads.
func (h *ReportHandler) SubmitReport(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return utils.SendError(
			c,
			fiber.StatusBadRequest,
			"INVALID_MULTIPART",
			"Request harus dikirim dalam format multipart/form-data yang valid.",
			nil,
		)
	}

	reporterName := strings.TrimSpace(c.FormValue("reporter_name"))
	reporterEmail := strings.TrimSpace(c.FormValue("reporter_email"))
	npm := strings.TrimSpace(c.FormValue("npm"))
	phoneNormalized := utils.NormalizePhone(c.FormValue("phone_number"))
	itemName := strings.TrimSpace(c.FormValue("item_name"))
	category := strings.TrimSpace(c.FormValue("category"))
	lossLocation := strings.TrimSpace(c.FormValue("loss_location"))
	lossDatetimeRaw := strings.TrimSpace(c.FormValue("loss_datetime"))
	itemDescription := strings.TrimSpace(c.FormValue("item_description"))
	secretTraits := strings.TrimSpace(c.FormValue("secret_traits"))
	reopenToken := strings.TrimSpace(c.FormValue("reopen_token"))

	if category == "" {
		category = utils.InferItemCategory(itemName, itemDescription)
	}

	fieldErrors := make(map[string]string)

	validateRequiredText(fieldErrors, "reporter_name", reporterName, 100, "Nama pelapor")
	if reporterEmail == "" {
		fieldErrors["reporter_email"] = "Email pelapor wajib diisi."
	} else if !utils.IsValidEmail(reporterEmail) {
		fieldErrors["reporter_email"] = "Format email pelapor tidak valid atau melebihi 100 karakter."
	}

	if npm == "" {
		fieldErrors["npm"] = "NPM wajib diisi."
	} else if !utils.IsValidNPM(npm) {
		fieldErrors["npm"] = "NPM harus berisi 8 hingga 15 digit angka."
	}

	if phoneNormalized == "" {
		fieldErrors["phone_number"] = "Nomor WhatsApp atau telepon wajib diisi."
	} else if !utils.IsValidIndonesianPhone(phoneNormalized) {
		fieldErrors["phone_number"] = "Nomor telepon harus menggunakan format Indonesia yang valid (mis. 0812xxxxxxxx atau +62812xxxxxxxx)."
	}

	validateRequiredText(fieldErrors, "item_name", itemName, 100, "Nama barang")
	validateRequiredText(fieldErrors, "category", category, 50, "Kategori barang")
	validateRequiredText(fieldErrors, "loss_location", lossLocation, 150, "Lokasi kehilangan")
	validateRequiredText(fieldErrors, "item_description", itemDescription, 0, "Deskripsi barang")
	validateRequiredText(fieldErrors, "secret_traits", secretTraits, 0, "Ciri rahasia barang")

	lossDatetime, dtErr := utils.ParsePastDateTime(lossDatetimeRaw)
	if dtErr != nil {
		fieldErrors["loss_datetime"] = dtErr.Message
	}

	var ktmFile *multipart.FileHeader
	ktmFiles := form.File["ktm_krs"]
	if len(ktmFiles) == 0 {
		fieldErrors["ktm_krs"] = "Foto/dokumen KTM atau KRS wajib diunggah."
	} else if len(ktmFiles) > 1 {
		fieldErrors["ktm_krs"] = "Hanya boleh mengunggah 1 file KTM atau KRS."
	} else {
		ktmFile = ktmFiles[0]
	}

	var itemImageFile *multipart.FileHeader
	itemImageFiles := form.File["item_image"]
	if len(itemImageFiles) > 1 {
		fieldErrors["item_image"] = "Hanya boleh mengunggah 1 file foto pendukung."
	} else if len(itemImageFiles) == 1 {
		itemImageFile = itemImageFiles[0]
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data laporan belum valid. Periksa kembali field yang ditandai.",
			fieldErrors,
		)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	if reopenToken != "" {
		if _, appErr := checkReopenTokenReport(config.DB, reopenToken); appErr != nil {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
	}

	savedKTM, saveErr := utils.SavePrivateFile(ktmFile, h.Cfg.UploadDir, h.Cfg.MaxUploadSizeBytes, "ktm_krs")
	if saveErr != nil {
		return utils.SendError(c, saveErr.Status, saveErr.Code, saveErr.Message, saveErr.Fields)
	}

	var itemImagePath *string
	var savedItemImg *utils.SavedPrivateFile
	if itemImageFile != nil {
		savedItemImg, saveErr = utils.SavePrivateFile(itemImageFile, h.Cfg.UploadDir, h.Cfg.MaxUploadSizeBytes, "item_image")
		if saveErr != nil {
			utils.RemovePrivateFile(h.Cfg.UploadDir, savedKTM.Filename)
			return utils.SendError(c, saveErr.Status, saveErr.Code, saveErr.Message, saveErr.Fields)
		}
		imgName := savedItemImg.Filename
		itemImagePath = &imgName
	}

	cleanupFiles := func() {
		utils.RemovePrivateFile(h.Cfg.UploadDir, savedKTM.Filename)
		if savedItemImg != nil {
			utils.RemovePrivateFile(h.Cfg.UploadDir, savedItemImg.Filename)
		}
	}

	var createdReport models.Report
	var lastErr error
	const maxTicketAttempts = 5

	for attempt := 0; attempt < maxTicketAttempts; attempt++ {
		ticketCode, genErr := utils.GenerateTicketCode()
		if genErr != nil {
			cleanupFiles()
			return utils.SendError(c, fiber.StatusInternalServerError, "TICKET_GENERATION_FAILED", "Gagal membuat kode tiket laporan.", nil)
		}

		report := models.Report{
			TicketCode:      ticketCode,
			ReporterName:    reporterName,
			ReporterEmail:   reporterEmail,
			NPM:             npm,
			PhoneNumber:     phoneNormalized,
			ItemName:        itemName,
			Category:        category,
			LossLocation:    lossLocation,
			LossDatetime:    lossDatetime,
			ItemDescription: itemDescription,
			SecretTraits:    secretTraits,
			KtmKrsPath:      savedKTM.Filename,
			ItemImagePath:   itemImagePath,
			Status:          models.ReportStatusBelumAda,
			IsStale:         false,
		}

		txErr := config.DB.Transaction(func(tx *gorm.DB) error {
			if reopenToken != "" {
				origReport, appErr := checkReopenTokenReport(tx.Clauses(clause.Locking{Strength: "UPDATE"}), reopenToken)
				if appErr != nil {
					return appErr
				}
				origCode := origReport.TicketCode
				report.ReopenedFromTicket = &origCode

				now := time.Now()
				if err := tx.Model(&models.Report{}).Where("id = ?", origReport.ID).Updates(map[string]interface{}{
					"resubmit_token_used_at": now,
					"updated_at":             now,
				}).Error; err != nil {
					return err
				}
			}

			if err := tx.Create(&report).Error; err != nil {
				return err
			}

			if report.ReopenedFromTicket != nil {
				if err := utils.RecordAuditLog(
					tx,
					nil,
					"REPORT_REOPENED",
					"reports",
					report.ID,
					map[string]interface{}{
						"ticket_code":          report.TicketCode,
						"reopened_from_ticket": *report.ReopenedFromTicket,
					},
					c.IP(),
				); err != nil {
					return err
				}
			}
			return nil
		})

		if txErr != nil {
			var appErr *utils.AppError
			if errors.As(txErr, &appErr) {
				cleanupFiles()
				return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
			}
			lastErr = txErr
			if isUniqueConstraintViolation(txErr) {
				continue
			}
			cleanupFiles()
			return utils.SendError(c, fiber.StatusInternalServerError, "REPORT_CREATE_FAILED", "Gagal menyimpan laporan kehilangan ke database.", nil)
		}

		createdReport = report
		lastErr = nil
		break
	}

	if lastErr != nil {
		cleanupFiles()
		return utils.SendError(c, fiber.StatusInternalServerError, "REPORT_CREATE_FAILED", "Gagal menghasilkan kode tiket unik setelah beberapa percobaan.", nil)
	}

	if h.Email != nil {
		h.Email.SendAsync(services.BuildReportConfirmationEmail(h.Cfg, &createdReport))
	}

	return utils.SendSuccess(c, fiber.StatusCreated, SubmitReportResponse{
		TicketCode:         createdReport.TicketCode,
		Status:             createdReport.Status,
		TrackingURL:        "/track/" + createdReport.TicketCode,
		Category:           createdReport.Category,
		ReopenedFromTicket: createdReport.ReopenedFromTicket,
	})
}

// ValidateReopenToken validates a single-use resubmit token (?reopen=<token>) and returns pre-fill fields.
func (h *ReportHandler) ValidateReopenToken(c *fiber.Ctx) error {
	token := strings.TrimSpace(c.Params("token"))
	if token == "" {
		return utils.SendError(c, fiber.StatusBadRequest, "REOPEN_TOKEN_INVALID", "Token pengajuan ulang tidak valid.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	report, appErr := checkReopenTokenReport(config.DB, token)
	if appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	cancelledFrom := ""
	if report.CancelledFrom != nil {
		cancelledFrom = *report.CancelledFrom
	}
	cancelReason := ""
	if report.CancelReason != nil {
		cancelReason = *report.CancelReason
	}
	cat := strings.TrimSpace(report.Category)
	if cat == "" {
		cat = utils.InferItemCategory(report.ItemName, report.ItemDescription)
	}

	return utils.SendSuccess(c, fiber.StatusOK, ReopenReportPrefillResponse{
		OriginalTicketCode: report.TicketCode,
		CancelledFrom:      cancelledFrom,
		CancelReason:       cancelReason,
		ReporterName:       report.ReporterName,
		ReporterEmail:      report.ReporterEmail,
		NPM:                report.NPM,
		PhoneNumber:        report.PhoneNumber,
		ItemName:           report.ItemName,
		Category:           cat,
		LossLocation:       report.LossLocation,
		LossDatetime:       report.LossDatetime,
		ItemDescription:    report.ItemDescription,
	})
}

func checkReopenTokenReport(db *gorm.DB, token string) (*models.Report, *utils.AppError) {
	var report models.Report
	if err := db.Where("resubmit_token = ?", token).First(&report).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, &utils.AppError{
				Status:  fiber.StatusNotFound,
				Code:    "REOPEN_TOKEN_INVALID",
				Message: "Tautan pengajuan ulang tidak ditemukan atau tidak valid.",
			}
		}
		return nil, &utils.AppError{
			Status:  fiber.StatusInternalServerError,
			Code:    "DB_QUERY_ERROR",
			Message: "Gagal memvalidasi token pengajuan ulang.",
		}
	}

	if report.Status != models.ReportStatusDibatalkan {
		return nil, &utils.AppError{
			Status:  fiber.StatusConflict,
			Code:    "REOPEN_TOKEN_INVALID_STATE",
			Message: "Tautan pengajuan ulang hanya berlaku untuk tiket yang berstatus 'Dibatalkan'.",
		}
	}

	if report.ResubmitTokenUsedAt != nil {
		return nil, &utils.AppError{
			Status:  fiber.StatusGone,
			Code:    "REOPEN_TOKEN_USED",
			Message: "Tautan pengajuan ulang ini sudah pernah digunakan untuk menerbitkan tiket pengganti.",
		}
	}

	if report.ResubmitTokenExpiresAt != nil && time.Now().After(*report.ResubmitTokenExpiresAt) {
		return nil, &utils.AppError{
			Status:  fiber.StatusGone,
			Code:    "REOPEN_TOKEN_EXPIRED",
			Message: "Tautan pengajuan ulang sudah kedaluwarsa (melewati batas 7 hari). Silakan buat laporan baru.",
		}
	}

	return &report, nil
}

// TrackReport verifies ticket_code + 4-digit challenge without revealing existence or sensitive details.
func (h *ReportHandler) TrackReport(c *fiber.Ctx) error {
	var req TrackReportRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	ticketCode := strings.ToUpper(strings.TrimSpace(req.TicketCode))
	verificationCode := strings.TrimSpace(req.VerificationCode)

	fieldErrors := make(map[string]string)
	if ticketCode == "" {
		fieldErrors["ticket_code"] = "Kode tiket wajib diisi."
	}
	if !fourDigitsRegex.MatchString(verificationCode) {
		fieldErrors["verification_code"] = "Kode verifikasi harus berupa 4 digit angka (4 digit terakhir NPM atau nomor WhatsApp)."
	}
	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data pelacakan tidak valid. Periksa kode tiket dan kode verifikasi.",
			fieldErrors,
		)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var report models.Report
	err := config.DB.Where("ticket_code = ?", ticketCode).First(&report).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return sendTrackingMismatch(c)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal memeriksa status laporan di database.", nil)
	}

	npmLast4 := utils.LastNDigits(report.NPM, 4)
	phoneLast4 := utils.LastNDigits(report.PhoneNumber, 4)
	if !utils.ConstantTimeEqual(verificationCode, npmLast4) && !utils.ConstantTimeEqual(verificationCode, phoneLast4) {
		return sendTrackingMismatch(c)
	}

	resp := TrackReportResponse{
		TicketCode: report.TicketCode,
		Status:     report.Status,
		IsStale:    report.IsStale,
		CreatedAt:  report.CreatedAt,
		Message:    publicStatusMessage(report.Status, report.IsStale),
	}

	if report.Status == models.ReportStatusPerluVerifikasi {
		resp.Visit = &TrackVisitInfo{
			Location:         h.Cfg.LoketLocation,
			Schedule:         h.Cfg.LoketSchedule,
			RequiredDocument: "KTM asli (fotokopi atau foto di ponsel tidak diterima).",
		}
	}

	if report.Status == models.ReportStatusDitolak && report.RejectionReason != nil {
		reason := strings.TrimSpace(*report.RejectionReason)
		if reason != "" {
			resp.PublicReason = &reason
		}
	} else if report.Status == models.ReportStatusDibatalkan && report.CancelReason != nil {
		reason := strings.TrimSpace(*report.CancelReason)
		if reason != "" {
			resp.PublicReason = &reason
		}
	}

	return utils.SendSuccess(c, fiber.StatusOK, resp)
}

func sendTrackingMismatch(c *fiber.Ctx) error {
	return utils.SendError(
		c,
		fiber.StatusNotFound,
		"TRACKING_NOT_FOUND",
		"Kode tiket atau kode verifikasi 4 digit tidak cocok. Periksa kembali keduanya.",
		nil,
	)
}

func publicStatusMessage(status string, isStale bool) string {
	switch status {
	case models.ReportStatusBelumAda:
		if isStale {
			return "Laporan sudah lebih dari 30 hari dan belum ditemukan barang yang cocok. Laporan tetap tersimpan dan masih dapat dipulihkan jika barang ditemukan."
		}
		return "Laporan sudah diterima, tetapi belum ada barang temuan yang cocok."
	case models.ReportStatusPerluVerifikasi:
		return "Ada kecocokan awal dengan barang di loket. Silakan datang ke loket membawa KTM asli untuk verifikasi fisik dan ciri rahasia barang."
	case models.ReportStatusSelesai:
		return "Serah terima barang telah selesai dilaksanakan dan tercatat."
	case models.ReportStatusDitolak:
		return "Laporan atau verifikasi di loket ditolak."
	case models.ReportStatusDibatalkan:
		return "Status verifikasi dibatalkan dan laporan sedang ditinjau ulang."
	default:
		return "Status laporan tercatat."
	}
}

func isUniqueConstraintViolation(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "sqlstate 23505")
}
