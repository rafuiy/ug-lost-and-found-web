package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"mime/multipart"
	"os"
	"strings"
	"time"

	"backend/config"
	"backend/middlewares"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type HandoverDetailResponse struct {
	ID               uuid.UUID `json:"id"`
	ReportID         uuid.UUID `json:"report_id"`
	TicketCode       string    `json:"ticket_code"`
	InventoryID      uuid.UUID `json:"inventory_id"`
	AdminID          uuid.UUID `json:"admin_id"`
	RecipientName    string    `json:"recipient_name"`
	RecipientNPM     string    `json:"recipient_npm"`
	HandoverNotes    *string   `json:"handover_notes"`
	HasHandoverProof bool      `json:"has_handover_proof"`
	ProofSHA256      string    `json:"proof_sha256"`
	CreatedAt        time.Time `json:"created_at"`
}

type CreateHandoverResponse struct {
	Handover        HandoverDetailResponse `json:"handover"`
	ReportStatus    string                 `json:"report_status"`
	InventoryStatus string                 `json:"inventory_status"`
}

type HandoverHandler struct {
	Cfg              *config.AppConfig
	BeforeCommitHook func(tx *gorm.DB) error
}

func NewHandoverHandler(cfg *config.AppConfig, beforeCommit func(tx *gorm.DB) error) *HandoverHandler {
	return &HandoverHandler{
		Cfg:              cfg,
		BeforeCommitHook: beforeCommit,
	}
}

// Create executes an atomic physical handover transaction:
// validates physical verification proof, creates handover record, marks report 'Selesai',
// marks inventory 'Diambil', and records an immutable audit log.
func (h *HandoverHandler) Create(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return utils.SendError(
			c,
			fiber.StatusBadRequest,
			"INVALID_MULTIPART",
			"Request serah terima harus dikirim dalam format multipart/form-data yang valid.",
			nil,
		)
	}

	reportIDRaw := strings.TrimSpace(c.FormValue("report_id"))
	inventoryIDRaw := strings.TrimSpace(c.FormValue("inventory_id"))
	recipientName := strings.TrimSpace(c.FormValue("recipient_name"))
	recipientNPM := strings.TrimSpace(c.FormValue("recipient_npm"))
	handoverNotesRaw := strings.TrimSpace(c.FormValue("handover_notes"))
	ktmVerifiedRaw := strings.ToLower(strings.TrimSpace(c.FormValue("ktm_verified")))
	secretVerifiedRaw := strings.ToLower(strings.TrimSpace(c.FormValue("secret_traits_verified")))

	fieldErrors := make(map[string]string)

	if reportIDRaw == "" {
		fieldErrors["report_id"] = "ID laporan atau kode tiket wajib diisi."
	} else if config.DB != nil {
		if _, appErr := applyReportIdentifierScope(config.DB, reportIDRaw); appErr != nil {
			fieldErrors["report_id"] = appErr.Message
		}
	}

	var inventoryID uuid.UUID
	if inventoryIDRaw == "" {
		fieldErrors["inventory_id"] = "ID inventori wajib diisi."
	} else {
		parsedInv, parseErr := uuid.Parse(inventoryIDRaw)
		if parseErr != nil {
			fieldErrors["inventory_id"] = "Format inventory_id harus berupa UUID yang valid."
		} else {
			inventoryID = parsedInv
		}
	}

	validateRequiredText(fieldErrors, "recipient_name", recipientName, 100, "Nama penerima")

	if recipientNPM == "" {
		fieldErrors["recipient_npm"] = "NPM penerima wajib diisi."
	} else if !utils.IsValidNPM(recipientNPM) {
		fieldErrors["recipient_npm"] = "NPM penerima harus berisi 8 hingga 15 digit angka."
	}

	if ktmVerifiedRaw != "" && ktmVerifiedRaw != "true" {
		fieldErrors["ktm_verified"] = "Verifikasi fisik KTM asli wajib dikonfirmasi sebelum serah terima."
	}
	if secretVerifiedRaw != "" && secretVerifiedRaw != "true" {
		fieldErrors["secret_traits_verified"] = "Verifikasi ciri rahasia barang wajib dikonfirmasi sebelum serah terima."
	}

	var proofFile *multipart.FileHeader
	proofFiles := form.File["handover_proof"]
	if len(proofFiles) == 0 {
		fieldErrors["handover_proof"] = "Foto/dokumen bukti serah terima wajib diunggah."
	} else if len(proofFiles) > 1 {
		fieldErrors["handover_proof"] = "Hanya boleh mengunggah 1 file bukti serah terima."
	} else {
		proofFile = proofFiles[0]
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data serah terima belum valid. Periksa kembali field yang ditandai.",
			fieldErrors,
		)
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	if !ok || adminID == uuid.Nil {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	savedProof, saveErr := utils.SavePrivateFile(proofFile, h.Cfg.UploadDir, h.Cfg.MaxUploadSizeBytes, "handover_proof")
	if saveErr != nil {
		return utils.SendError(c, saveErr.Status, saveErr.Code, saveErr.Message, saveErr.Fields)
	}

	absProofPath, err := utils.ResolvePrivateFilePath(h.Cfg.UploadDir, savedProof.Filename)
	if err != nil {
		utils.RemovePrivateFile(h.Cfg.UploadDir, savedProof.Filename)
		return utils.SendError(c, fiber.StatusInternalServerError, "FILE_SAVE_FAILED", "Gagal memverifikasi lokasi file bukti serah terima.", nil)
	}
	proofBytes, err := os.ReadFile(absProofPath)
	if err != nil {
		utils.RemovePrivateFile(h.Cfg.UploadDir, savedProof.Filename)
		return utils.SendError(c, fiber.StatusInternalServerError, "FILE_READ_FAILED", "Gagal membaca file bukti serah terima untuk verifikasi hash.", nil)
	}
	proofSum := sha256.Sum256(proofBytes)
	proofSHA256 := hex.EncodeToString(proofSum[:])

	var notesPtr *string
	if handoverNotesRaw != "" {
		notesPtr = &handoverNotesRaw
	}

	var createdHandover models.Handover
	var ticketCode string

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		scopedTX, appErr := applyReportIdentifierScope(tx, reportIDRaw)
		if appErr != nil {
			return appErr
		}

		var report models.Report
		if err := scopedTX.Clauses(clause.Locking{Strength: "UPDATE"}).First(&report).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &utils.AppError{
					Status:  fiber.StatusNotFound,
					Code:    "REPORT_NOT_FOUND",
					Message: "Data laporan tidak ditemukan.",
				}
			}
			return err
		}

		if report.Status != models.ReportStatusPerluVerifikasi {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "INVALID_REPORT_STATUS",
				Message: fmt.Sprintf("Serah terima hanya dapat dilakukan untuk laporan berstatus 'Perlu Verifikasi' (status saat ini: '%s').", report.Status),
			}
		}

		var existingHandoverCount int64
		if err := tx.Model(&models.Handover{}).Where("report_id = ?", report.ID).Count(&existingHandoverCount).Error; err != nil {
			return err
		}
		if existingHandoverCount > 0 {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "HANDOVER_ALREADY_EXISTS",
				Message: "Laporan ini sudah memiliki catatan serah terima dan tidak dapat diproses ulang.",
			}
		}

		var inv models.Inventory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", inventoryID).First(&inv).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &utils.AppError{
					Status:  fiber.StatusNotFound,
					Code:    "INVENTORY_NOT_FOUND",
					Message: "Data inventori yang dipilih tidak ditemukan.",
				}
			}
			return err
		}

		if inv.Status != models.InventoryStatusTersimpan {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "INVENTORY_ALREADY_CLAIMED",
				Message: "Inventori yang dipilih sudah berstatus 'Diambil' dan tidak dapat diserahkan ulang.",
			}
		}

		now := time.Now()
		handover := models.Handover{
			ReportID:          report.ID,
			InventoryID:       inv.ID,
			AdminID:           adminID,
			RecipientName:     recipientName,
			RecipientNPM:      recipientNPM,
			HandoverProofPath: savedProof.Filename,
			HandoverNotes:     notesPtr,
		}
		if err := tx.Create(&handover).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Report{}).Where("id = ?", report.ID).Updates(map[string]interface{}{
			"status":               models.ReportStatusSelesai,
			"matched_inventory_id": inv.ID,
			"updated_at":           now,
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Inventory{}).Where("id = ?", inv.ID).Updates(map[string]interface{}{
			"status":     models.InventoryStatusDiambil,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}

		if err := utils.RecordAuditLog(
			tx,
			&adminID,
			"HANDOVER_COMPLETED",
			"handovers",
			handover.ID,
			map[string]interface{}{
				"handover_id":            handover.ID,
				"report_id":              report.ID,
				"ticket_code":            report.TicketCode,
				"inventory_id":           inv.ID,
				"recipient_name":         handover.RecipientName,
				"recipient_npm":          handover.RecipientNPM,
				"ktm_verified":           true,
				"secret_traits_verified": true,
				"proof_sha256":           proofSHA256,
			},
			c.IP(),
		); err != nil {
			return err
		}

		if h.BeforeCommitHook != nil {
			if err := h.BeforeCommitHook(tx); err != nil {
				return err
			}
		}

		createdHandover = handover
		ticketCode = report.TicketCode
		return nil
	})

	if txErr != nil {
		utils.RemovePrivateFile(h.Cfg.UploadDir, savedProof.Filename)

		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		if isUniqueConstraintViolation(txErr) {
			return utils.SendError(
				c,
				fiber.StatusConflict,
				"HANDOVER_ALREADY_EXISTS",
				"Laporan ini sudah memiliki catatan serah terima dan tidak dapat diproses ulang.",
				nil,
			)
		}
		return utils.SendError(
			c,
			fiber.StatusInternalServerError,
			"HANDOVER_FAILED",
			"Gagal menyelesaikan transaksi serah terima. Seluruh perubahan telah dibatalkan (rollback).",
			nil,
		)
	}

	return utils.SendSuccess(c, fiber.StatusCreated, CreateHandoverResponse{
		Handover: HandoverDetailResponse{
			ID:               createdHandover.ID,
			ReportID:         createdHandover.ReportID,
			TicketCode:       ticketCode,
			InventoryID:      createdHandover.InventoryID,
			AdminID:          createdHandover.AdminID,
			RecipientName:    createdHandover.RecipientName,
			RecipientNPM:     createdHandover.RecipientNPM,
			HandoverNotes:    createdHandover.HandoverNotes,
			HasHandoverProof: true,
			ProofSHA256:      proofSHA256,
			CreatedAt:        createdHandover.CreatedAt,
		},
		ReportStatus:    models.ReportStatusSelesai,
		InventoryStatus: models.InventoryStatusDiambil,
	})
}
