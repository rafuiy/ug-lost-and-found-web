package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ticketCodeLookupRegex = regexp.MustCompile(`^UG-[A-Z0-9]{3,10}$`)

var allowedAdminReportSortColumns = map[string]string{
	"created_at":    "created_at",
	"loss_datetime": "loss_datetime",
	"status":        "status",
	"ticket_code":   "ticket_code",
	"updated_at":    "updated_at",
}

var validReportStatuses = map[string]bool{
	models.ReportStatusBelumAda:        true,
	models.ReportStatusPerluVerifikasi: true,
	models.ReportStatusSelesai:         true,
	models.ReportStatusDitolak:         true,
	models.ReportStatusDibatalkan:      true,
}

var allowedStatusTransitions = map[string]map[string]bool{
	models.ReportStatusBelumAda: {
		models.ReportStatusPerluVerifikasi: true,
		models.ReportStatusDitolak:         true,
	},
	models.ReportStatusPerluVerifikasi: {
		models.ReportStatusBelumAda:   true,
		models.ReportStatusDitolak:    true,
		models.ReportStatusDibatalkan: true,
	},
	models.ReportStatusDibatalkan: {
		models.ReportStatusBelumAda: true,
	},
}

type AdminReportListItem struct {
	ID                 uuid.UUID  `json:"id"`
	TicketCode         string     `json:"ticket_code"`
	ReporterName       string     `json:"reporter_name"`
	NPM                string     `json:"npm"`
	ItemName           string     `json:"item_name"`
	LossLocation       string     `json:"loss_location"`
	LossDatetime       time.Time  `json:"loss_datetime"`
	Status             string     `json:"status"`
	IsStale            bool       `json:"is_stale"`
	MatchedInventoryID *uuid.UUID `json:"matched_inventory_id"`
	HasKtmKrs          bool       `json:"has_ktm_krs"`
	HasItemImage       bool       `json:"has_item_image"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type AdminReportStats struct {
	Total           int64 `json:"total"`
	BelumAda        int64 `json:"belum_ada"`
	PerluVerifikasi int64 `json:"perlu_verifikasi"`
	Selesai         int64 `json:"selesai"`
	Ditolak         int64 `json:"ditolak"`
	Dibatalkan      int64 `json:"dibatalkan"`
	Lawas           int64 `json:"lawas"`
}

type AdminReportListMeta struct {
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
	Total      int64            `json:"total"`
	TotalPages int64            `json:"total_pages"`
	Counts     AdminReportStats `json:"counts"`
}

type AdminReportFileInfo struct {
	HasKtmKrs        bool `json:"has_ktm_krs"`
	HasItemImage     bool `json:"has_item_image"`
	HasHandoverProof bool `json:"has_handover_proof"`
}

type AdminReportDetail struct {
	ID                 uuid.UUID           `json:"id"`
	TicketCode         string              `json:"ticket_code"`
	ReporterName       string              `json:"reporter_name"`
	ReporterEmail      string              `json:"reporter_email"`
	NPM                string              `json:"npm"`
	PhoneNumber        string              `json:"phone_number"`
	ItemName           string              `json:"item_name"`
	LossLocation       string              `json:"loss_location"`
	LossDatetime       time.Time           `json:"loss_datetime"`
	ItemDescription    string              `json:"item_description"`
	SecretTraits       string              `json:"secret_traits"`
	Status             string              `json:"status"`
	IsStale            bool                `json:"is_stale"`
	RestoredAt         *time.Time          `json:"restored_at"`
	AdminNotes         *string             `json:"admin_notes"`
	RejectionReason    *string             `json:"rejection_reason"`
	MatchedInventoryID *uuid.UUID          `json:"matched_inventory_id"`
	MatchedInventory   *models.Inventory   `json:"matched_inventory,omitempty"`
	Handover           *models.Handover    `json:"handover,omitempty"`
	Files              AdminReportFileInfo `json:"files"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
}

type EmailNotificationInfo struct {
	Queued    bool   `json:"queued"`
	EventType string `json:"event_type,omitempty"`
	Recipient string `json:"recipient,omitempty"`
}

type UpdateReportStatusRequest struct {
	Status             string  `json:"status"`
	AdminNotes         *string `json:"admin_notes"`
	RejectionReason    *string `json:"rejection_reason"`
	MatchedInventoryID *string `json:"matched_inventory_id"`
}

type UpdateReportNotesRequest struct {
	AdminNotes         *string `json:"admin_notes"`
	MatchedInventoryID *string `json:"matched_inventory_id"`
}

type RestoreReportRequest struct {
	AdminNotes *string `json:"admin_notes"`
}

type AdminReportHandler struct {
	Cfg   *config.AppConfig
	Email services.EmailSender
}

func NewAdminReportHandler(cfg *config.AppConfig, email services.EmailSender) *AdminReportHandler {
	return &AdminReportHandler{
		Cfg:   cfg,
		Email: email,
	}
}

// List returns paginated report summaries (without secret_traits or file paths) and queue counts.
func (h *AdminReportHandler) List(c *fiber.Ctx) error {
	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	fieldErrors := make(map[string]string)

	status := strings.TrimSpace(c.Query("status"))
	if status != "" && !validReportStatuses[status] {
		fieldErrors["status"] = "Status laporan tidak valid. Pilihan: Belum Ada, Perlu Verifikasi, Selesai, Ditolak, Dibatalkan."
	}

	var isStalePtr *bool
	if rawStale := strings.TrimSpace(c.Query("is_stale")); rawStale != "" {
		parsed, err := strconv.ParseBool(rawStale)
		if err != nil {
			fieldErrors["is_stale"] = "Parameter is_stale harus bernilai 'true' atau 'false'."
		} else {
			isStalePtr = &parsed
		}
	}

	var dateFromPtr *time.Time
	if rawFrom := strings.TrimSpace(c.Query("date_from")); rawFrom != "" {
		parsed, err := parseFilterDate(rawFrom, false)
		if err != nil {
			fieldErrors["date_from"] = "Format date_from tidak valid. Gunakan YYYY-MM-DD atau ISO-8601."
		} else {
			dateFromPtr = &parsed
		}
	}

	var dateToPtr *time.Time
	if rawTo := strings.TrimSpace(c.Query("date_to")); rawTo != "" {
		parsed, err := parseFilterDate(rawTo, true)
		if err != nil {
			fieldErrors["date_to"] = "Format date_to tidak valid. Gunakan YYYY-MM-DD atau ISO-8601."
		} else {
			dateToPtr = &parsed
		}
	}

	if dateFromPtr != nil && dateToPtr != nil && dateFromPtr.After(*dateToPtr) {
		fieldErrors["date_from"] = "Tanggal mulai (date_from) tidak boleh lebih besar dari date_to."
	}

	page := 1
	if rawPage := strings.TrimSpace(c.Query("page")); rawPage != "" {
		parsed, err := strconv.Atoi(rawPage)
		if err != nil || parsed < 1 {
			fieldErrors["page"] = "Parameter page harus berupa bilangan bulat >= 1."
		} else {
			page = parsed
		}
	}

	limit := 20
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 100 {
			fieldErrors["limit"] = "Parameter limit harus berupa bilangan bulat antara 1 hingga 100."
		} else {
			limit = parsed
		}
	}

	sortKey := strings.TrimSpace(c.Query("sort", "created_at"))
	sortCol, ok := allowedAdminReportSortColumns[sortKey]
	if !ok {
		fieldErrors["sort"] = "Kolom sort tidak valid. Pilihan: created_at, loss_datetime, status, ticket_code, updated_at."
	}

	orderDir := strings.ToLower(strings.TrimSpace(c.Query("order", "desc")))
	if orderDir != "asc" && orderDir != "desc" {
		fieldErrors["order"] = "Parameter order harus 'asc' atau 'desc'."
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(c, fiber.StatusUnprocessableEntity, "VALIDATION_ERROR", "Parameter filter laporan tidak valid.", fieldErrors)
	}

	var counts AdminReportStats
	if err := config.DB.Model(&models.Report{}).Select(
		"COUNT(*) AS total, "+
			"COUNT(*) FILTER (WHERE status = ?) AS belum_ada, "+
			"COUNT(*) FILTER (WHERE status = ?) AS perlu_verifikasi, "+
			"COUNT(*) FILTER (WHERE status = ?) AS selesai, "+
			"COUNT(*) FILTER (WHERE status = ?) AS ditolak, "+
			"COUNT(*) FILTER (WHERE status = ?) AS dibatalkan, "+
			"COUNT(*) FILTER (WHERE is_stale = TRUE) AS lawas",
		models.ReportStatusBelumAda,
		models.ReportStatusPerluVerifikasi,
		models.ReportStatusSelesai,
		models.ReportStatusDitolak,
		models.ReportStatusDibatalkan,
	).Scan(&counts).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal menghitung ringkasan antrean laporan.", nil)
	}

	query := config.DB.Model(&models.Report{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if isStalePtr != nil {
		query = query.Where("is_stale = ?", *isStalePtr)
	}
	if dateFromPtr != nil {
		query = query.Where("created_at >= ?", *dateFromPtr)
	}
	if dateToPtr != nil {
		query = query.Where("created_at <= ?", *dateToPtr)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"(ticket_code ILIKE ? OR reporter_name ILIKE ? OR npm ILIKE ? OR item_name ILIKE ? OR loss_location ILIKE ?)",
			like, like, like, like, like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal menghitung jumlah laporan.", nil)
	}

	var rows []models.Report
	offset := (page - 1) * limit
	if err := query.Order(sortCol + " " + strings.ToUpper(orderDir)).Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal memuat daftar laporan dari database.", nil)
	}

	items := make([]AdminReportListItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, AdminReportListItem{
			ID:                 r.ID,
			TicketCode:         r.TicketCode,
			ReporterName:       r.ReporterName,
			NPM:                r.NPM,
			ItemName:           r.ItemName,
			LossLocation:       r.LossLocation,
			LossDatetime:       r.LossDatetime,
			Status:             r.Status,
			IsStale:            r.IsStale,
			MatchedInventoryID: r.MatchedInventoryID,
			HasKtmKrs:          r.KtmKrsPath != "",
			HasItemImage:       r.ItemImagePath != nil && strings.TrimSpace(*r.ItemImagePath) != "",
			CreatedAt:          r.CreatedAt,
			UpdatedAt:          r.UpdatedAt,
		})
	}

	var totalPages int64
	if total > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}

	return utils.SendSuccessWithMeta(c, fiber.StatusOK, items, AdminReportListMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
		Counts:     counts,
	})
}

// GetDetail returns complete report review data (including secret_traits and file availability) by UUID or ticket code.
func (h *AdminReportHandler) GetDetail(c *fiber.Ctx) error {
	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	scopedDB, appErr := applyReportIdentifierScope(config.DB, c.Params("id"))
	if appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	var report models.Report
	if err := scopedDB.Preload("MatchedInventory").Preload("Handover").First(&report).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.SendError(c, fiber.StatusNotFound, "REPORT_NOT_FOUND", "Data laporan tidak ditemukan.", nil)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal mengambil detail laporan dari database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, buildAdminReportDetail(&report))
}

// UpdateStatus enforces the report status state machine, logs audit history, and dispatches async notifications.
func (h *AdminReportHandler) UpdateStatus(c *fiber.Ctx) error {
	var req UpdateReportStatusRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	targetStatus := strings.TrimSpace(req.Status)
	if targetStatus == "" {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Status tujuan wajib diisi.",
			map[string]string{"status": "Status tujuan wajib diisi."},
		)
	}

	if targetStatus == models.ReportStatusSelesai {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"HANDOVER_REQUIRED",
			"Status 'Selesai' tidak dapat diubah langsung. Gunakan endpoint serah terima (POST /api/v1/admin/handovers).",
			map[string]string{"status": "Gunakan proses serah terima untuk menyelesaikan laporan."},
		)
	}

	if !validReportStatuses[targetStatus] {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Status laporan tidak valid.",
			map[string]string{"status": "Pilihan status: Belum Ada, Perlu Verifikasi, Ditolak, Dibatalkan."},
		)
	}

	var trimmedRejectionReason string
	if req.RejectionReason != nil {
		trimmedRejectionReason = strings.TrimSpace(*req.RejectionReason)
	}
	if targetStatus == models.ReportStatusDitolak && trimmedRejectionReason == "" {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Alasan penolakan wajib diisi saat menolak laporan.",
			map[string]string{"rejection_reason": "Alasan penolakan wajib diisi."},
		)
	}

	var parsedMatchedInvID *uuid.UUID
	clearMatchedInv := false
	if req.MatchedInventoryID != nil {
		rawInv := strings.TrimSpace(*req.MatchedInventoryID)
		if rawInv == "" {
			clearMatchedInv = true
		} else {
			uid, err := uuid.Parse(rawInv)
			if err != nil {
				return utils.SendError(
					c,
					fiber.StatusUnprocessableEntity,
					"VALIDATION_ERROR",
					"Format matched_inventory_id tidak valid.",
					map[string]string{"matched_inventory_id": "Harus berupa UUID inventori yang valid."},
				)
			}
			parsedMatchedInvID = &uid
		}
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	if !ok || adminID == uuid.Nil {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var prevStatus string
	var updated models.Report

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		scopedTX, appErr := applyReportIdentifierScope(tx, c.Params("id"))
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

		prevStatus = report.Status
		if report.Status == models.ReportStatusSelesai {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "REPORT_ALREADY_COMPLETED",
				Message: "Laporan yang sudah berstatus 'Selesai' bersifat final dan tidak dapat diubah statusnya.",
			}
		}

		allowedTargets, hasState := allowedStatusTransitions[report.Status]
		if !hasState || !allowedTargets[targetStatus] {
			return &utils.AppError{
				Status:  fiber.StatusUnprocessableEntity,
				Code:    "INVALID_STATUS_TRANSITION",
				Message: fmt.Sprintf("Transisi status dari '%s' ke '%s' tidak diizinkan.", report.Status, targetStatus),
			}
		}

		updates := map[string]interface{}{
			"status":     targetStatus,
			"updated_at": time.Now(),
		}

		if parsedMatchedInvID != nil {
			var inv models.Inventory
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", *parsedMatchedInvID).First(&inv).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return &utils.AppError{
						Status:  fiber.StatusNotFound,
						Code:    "INVENTORY_NOT_FOUND",
						Message: "Inventori yang dipasangkan tidak ditemukan.",
					}
				}
				return err
			}
			if inv.Status != models.InventoryStatusTersimpan {
				return &utils.AppError{
					Status:  fiber.StatusConflict,
					Code:    "INVENTORY_ALREADY_CLAIMED",
					Message: "Inventori yang dipilih sudah berstatus 'Diambil' dan tidak dapat dipasangkan.",
				}
			}
			updates["matched_inventory_id"] = *parsedMatchedInvID
		} else if clearMatchedInv || targetStatus == models.ReportStatusBelumAda || targetStatus == models.ReportStatusDibatalkan {
			updates["matched_inventory_id"] = nil
		}

		if req.AdminNotes != nil {
			trimmedNotes := strings.TrimSpace(*req.AdminNotes)
			if trimmedNotes == "" {
				updates["admin_notes"] = nil
			} else {
				updates["admin_notes"] = trimmedNotes
			}
		}

		if targetStatus == models.ReportStatusDitolak {
			updates["rejection_reason"] = trimmedRejectionReason
		}

		if err := tx.Model(&models.Report{}).Where("id = ?", report.ID).Updates(updates).Error; err != nil {
			return err
		}

		if err := tx.Preload("MatchedInventory").Preload("Handover").Where("id = ?", report.ID).First(&updated).Error; err != nil {
			return err
		}

		auditAction := "REPORT_STATUS_UPDATED"
		if targetStatus == models.ReportStatusDitolak {
			auditAction = "REPORT_REJECTED"
		}

		return utils.RecordAuditLog(
			tx,
			&adminID,
			auditAction,
			"reports",
			updated.ID,
			map[string]interface{}{
				"ticket_code":          updated.TicketCode,
				"previous_status":      prevStatus,
				"new_status":           updated.Status,
				"matched_inventory_id": updated.MatchedInventoryID,
				"has_rejection_reason": targetStatus == models.ReportStatusDitolak,
			},
			c.IP(),
		)
	})

	if txErr != nil {
		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "REPORT_STATUS_UPDATE_FAILED", "Gagal memperbarui status laporan di database.", nil)
	}

	emailInfo := EmailNotificationInfo{Queued: false}
	if h.Email != nil && utils.IsValidEmail(updated.ReporterEmail) {
		switch updated.Status {
		case models.ReportStatusPerluVerifikasi:
			msg := services.BuildVerificationInvitationEmail(h.Cfg, &updated)
			h.Email.SendAsync(msg)
			emailInfo = EmailNotificationInfo{
				Queued:    true,
				EventType: msg.EventType,
				Recipient: updated.ReporterEmail,
			}
		case models.ReportStatusDitolak:
			msg := services.BuildReportRejectionEmail(h.Cfg, &updated, trimmedRejectionReason)
			h.Email.SendAsync(msg)
			emailInfo = EmailNotificationInfo{
				Queued:    true,
				EventType: msg.EventType,
				Recipient: updated.ReporterEmail,
			}
		}
	}

	return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{
		"report":             buildAdminReportDetail(&updated),
		"email_notification": emailInfo,
	})
}

// UpdateNotes updates internal admin notes and/or matched_inventory_id without changing status or sending email.
func (h *AdminReportHandler) UpdateNotes(c *fiber.Ctx) error {
	var req UpdateReportNotesRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	if req.AdminNotes == nil && req.MatchedInventoryID == nil {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Minimal satu field (admin_notes atau matched_inventory_id) wajib diisi.",
			nil,
		)
	}

	var parsedMatchedInvID *uuid.UUID
	clearMatchedInv := false
	if req.MatchedInventoryID != nil {
		rawInv := strings.TrimSpace(*req.MatchedInventoryID)
		if rawInv == "" {
			clearMatchedInv = true
		} else {
			uid, err := uuid.Parse(rawInv)
			if err != nil {
				return utils.SendError(
					c,
					fiber.StatusUnprocessableEntity,
					"VALIDATION_ERROR",
					"Format matched_inventory_id tidak valid.",
					map[string]string{"matched_inventory_id": "Harus berupa UUID inventori yang valid."},
				)
			}
			parsedMatchedInvID = &uid
		}
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	if !ok || adminID == uuid.Nil {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var updated models.Report
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		scopedTX, appErr := applyReportIdentifierScope(tx, c.Params("id"))
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

		updates := map[string]interface{}{
			"updated_at": time.Now(),
		}

		if req.AdminNotes != nil {
			trimmed := strings.TrimSpace(*req.AdminNotes)
			if trimmed == "" {
				updates["admin_notes"] = nil
			} else {
				updates["admin_notes"] = trimmed
			}
		}

		if parsedMatchedInvID != nil {
			var inv models.Inventory
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", *parsedMatchedInvID).First(&inv).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return &utils.AppError{
						Status:  fiber.StatusNotFound,
						Code:    "INVENTORY_NOT_FOUND",
						Message: "Inventori yang dipasangkan tidak ditemukan.",
					}
				}
				return err
			}
			if inv.Status != models.InventoryStatusTersimpan {
				return &utils.AppError{
					Status:  fiber.StatusConflict,
					Code:    "INVENTORY_ALREADY_CLAIMED",
					Message: "Inventori yang dipilih sudah berstatus 'Diambil' dan tidak dapat dipasangkan.",
				}
			}
			updates["matched_inventory_id"] = *parsedMatchedInvID
		} else if clearMatchedInv {
			updates["matched_inventory_id"] = nil
		}

		if err := tx.Model(&models.Report{}).Where("id = ?", report.ID).Updates(updates).Error; err != nil {
			return err
		}

		if err := tx.Preload("MatchedInventory").Preload("Handover").Where("id = ?", report.ID).First(&updated).Error; err != nil {
			return err
		}

		return utils.RecordAuditLog(
			tx,
			&adminID,
			"REPORT_NOTES_UPDATED",
			"reports",
			updated.ID,
			map[string]interface{}{
				"ticket_code":          updated.TicketCode,
				"matched_inventory_id": updated.MatchedInventoryID,
				"notes_updated":        req.AdminNotes != nil,
			},
			c.IP(),
		)
	})

	if txErr != nil {
		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "REPORT_NOTES_UPDATE_FAILED", "Gagal memperbarui catatan laporan di database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, buildAdminReportDetail(&updated))
}

// Restore recovers a stale 'Belum Ada' report back to the active queue and records an audit log.
func (h *AdminReportHandler) Restore(c *fiber.Ctx) error {
	var req RestoreReportRequest
	if len(bytes.TrimSpace(c.Body())) > 0 {
		if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	if !ok || adminID == uuid.Nil {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var updated models.Report
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		scopedTX, appErr := applyReportIdentifierScope(tx, c.Params("id"))
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

		if !report.IsStale {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "REPORT_NOT_STALE",
				Message: "Laporan ini tidak berstatus lawas sehingga tidak perlu dipulihkan.",
			}
		}

		if report.Status != models.ReportStatusBelumAda {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "INVALID_REPORT_STATUS",
				Message: fmt.Sprintf("Hanya laporan lawas berstatus 'Belum Ada' yang dapat dipulihkan (status saat ini: '%s').", report.Status),
			}
		}

		now := time.Now()
		updates := map[string]interface{}{
			"is_stale":    false,
			"restored_at": now,
			"updated_at":  now,
		}
		if req.AdminNotes != nil {
			trimmed := strings.TrimSpace(*req.AdminNotes)
			if trimmed == "" {
				updates["admin_notes"] = nil
			} else {
				updates["admin_notes"] = trimmed
			}
		}

		if err := tx.Model(&models.Report{}).Where("id = ?", report.ID).Updates(updates).Error; err != nil {
			return err
		}

		if err := tx.Preload("MatchedInventory").Preload("Handover").Where("id = ?", report.ID).First(&updated).Error; err != nil {
			return err
		}

		return utils.RecordAuditLog(
			tx,
			&adminID,
			"REPORT_RESTORED",
			"reports",
			updated.ID,
			map[string]interface{}{
				"ticket_code":       updated.TicketCode,
				"previous_is_stale": true,
				"new_is_stale":      false,
				"restored_at":       now,
			},
			c.IP(),
		)
	})

	if txErr != nil {
		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "REPORT_RESTORE_FAILED", "Gagal memulihkan laporan lawas di database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, buildAdminReportDetail(&updated))
}

// StreamPrivateFile securely streams a private document after authorization, traversal checks, and audit logging.
func (h *AdminReportHandler) StreamPrivateFile(c *fiber.Ctx) error {
	rawFileType := strings.ToLower(strings.TrimSpace(c.Params("file_type")))
	var canonicalType string
	switch rawFileType {
	case "ktm_krs", "ktm":
		canonicalType = "ktm_krs"
	case "item_image", "item":
		canonicalType = "item_image"
	case "handover_proof":
		canonicalType = "handover_proof"
	default:
		return utils.SendError(
			c,
			fiber.StatusBadRequest,
			"INVALID_FILE_TYPE",
			"Tipe file tidak valid. Pilihan yang diizinkan: ktm_krs, item_image, handover_proof.",
			nil,
		)
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uuid.UUID)
	if !ok || adminID == uuid.Nil {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	scopedDB, appErr := applyReportIdentifierScope(config.DB, c.Params("id"))
	if appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	if canonicalType == "handover_proof" {
		scopedDB = scopedDB.Preload("Handover")
	}

	var report models.Report
	if err := scopedDB.First(&report).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.SendError(c, fiber.StatusNotFound, "REPORT_NOT_FOUND", "Data laporan tidak ditemukan.", nil)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal mengambil data file laporan dari database.", nil)
	}

	var storedFilename string
	switch canonicalType {
	case "ktm_krs":
		storedFilename = report.KtmKrsPath
	case "item_image":
		if report.ItemImagePath != nil {
			storedFilename = *report.ItemImagePath
		}
	case "handover_proof":
		if report.Handover != nil {
			storedFilename = report.Handover.HandoverProofPath
		}
	}

	if strings.TrimSpace(storedFilename) == "" {
		return utils.SendError(c, fiber.StatusNotFound, "FILE_NOT_UPLOADED", "File yang diminta tidak tersedia pada laporan ini.", nil)
	}

	absPath, err := utils.ResolvePrivateFilePath(h.Cfg.UploadDir, storedFilename)
	if err != nil {
		return utils.SendError(c, fiber.StatusBadRequest, "INVALID_FILE_PATH", "Lokasi file privat tidak valid atau melanggar batas direktori penyimpanan.", nil)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return utils.SendError(c, fiber.StatusNotFound, "FILE_NOT_FOUND", "File fisik tidak ditemukan di penyimpanan privat server.", nil)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "FILE_READ_FAILED", "Gagal membaca file privat dari penyimpanan server.", nil)
	}

	sum := sha256.Sum256(data)
	sha256Hex := hex.EncodeToString(sum[:])
	detectedMIME := http.DetectContentType(data)
	ext := filepath.Ext(storedFilename)

	if err := utils.RecordAuditLog(
		config.DB,
		&adminID,
		"REPORT_FILE_ACCESSED",
		"reports",
		report.ID,
		map[string]interface{}{
			"ticket_code": report.TicketCode,
			"file_type":   canonicalType,
			"sha256":      sha256Hex,
		},
		c.IP(),
	); err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "AUDIT_LOG_FAILED", "Gagal mencatat log audit akses file privat.", nil)
	}

	downloadName := fmt.Sprintf("%s-%s%s", report.TicketCode, canonicalType, ext)
	c.Set("Content-Type", detectedMIME)
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Cache-Control", "no-store, private")
	c.Set("Pragma", "no-cache")
	c.Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", downloadName))
	c.Set("X-File-SHA256", sha256Hex)

	return c.Status(fiber.StatusOK).Send(data)
}

func applyReportIdentifierScope(db *gorm.DB, rawID string) (*gorm.DB, *utils.AppError) {
	trimmed := strings.TrimSpace(rawID)
	if uid, err := uuid.Parse(trimmed); err == nil {
		return db.Where("id = ?", uid), nil
	}

	upper := strings.ToUpper(trimmed)
	if ticketCodeLookupRegex.MatchString(upper) {
		return db.Where("ticket_code = ?", upper), nil
	}

	return nil, &utils.AppError{
		Status:  fiber.StatusBadRequest,
		Code:    "INVALID_REPORT_ID",
		Message: "Parameter ID laporan tidak valid (gunakan UUID laporan atau kode tiket berformat UG-XXXXX).",
	}
}

func buildAdminReportDetail(r *models.Report) AdminReportDetail {
	return AdminReportDetail{
		ID:                 r.ID,
		TicketCode:         r.TicketCode,
		ReporterName:       r.ReporterName,
		ReporterEmail:      r.ReporterEmail,
		NPM:                r.NPM,
		PhoneNumber:        r.PhoneNumber,
		ItemName:           r.ItemName,
		LossLocation:       r.LossLocation,
		LossDatetime:       r.LossDatetime,
		ItemDescription:    r.ItemDescription,
		SecretTraits:       r.SecretTraits,
		Status:             r.Status,
		IsStale:            r.IsStale,
		RestoredAt:         r.RestoredAt,
		AdminNotes:         r.AdminNotes,
		RejectionReason:    r.RejectionReason,
		MatchedInventoryID: r.MatchedInventoryID,
		MatchedInventory:   r.MatchedInventory,
		Handover:           r.Handover,
		Files: AdminReportFileInfo{
			HasKtmKrs:        strings.TrimSpace(r.KtmKrsPath) != "",
			HasItemImage:     r.ItemImagePath != nil && strings.TrimSpace(*r.ItemImagePath) != "",
			HasHandoverProof: r.Handover != nil && strings.TrimSpace(r.Handover.HandoverProofPath) != "",
		},
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

func parseFilterDate(raw string, endOfDay bool) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, nil
		}
	}

	loc := time.Local
	if loc == nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	if t, err := time.ParseInLocation("2006-01-02", raw, loc); err == nil {
		if endOfDay {
			return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, int(time.Second-time.Nanosecond), loc), nil
		}
		return t, nil
	}

	return time.Time{}, fmt.Errorf("invalid filter date format")
}
