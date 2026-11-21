package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var allowedAuditTargetTables = map[string]bool{
	"admins":         true,
	"reports":        true,
	"inventories":    true,
	"handovers":      true,
	"revoked_tokens": true,
}

var allowedAuditSortColumns = map[string]string{
	"created_at":   "audit_logs.created_at",
	"action":       "audit_logs.action",
	"target_table": "audit_logs.target_table",
}

type AuditLogItemResponse struct {
	ID            uint           `json:"id"`
	AdminID       *uint          `json:"admin_id"`
	ActorName     string         `json:"actor_name"`
	ActorUsername string         `json:"actor_username,omitempty"`
	ActorRole     string         `json:"actor_role,omitempty"`
	Action        string         `json:"action"`
	TargetTable   string         `json:"target_table"`
	TargetID      uint           `json:"target_id"`
	Payload       datatypes.JSON `json:"payload"`
	IPAddress     *string        `json:"ip_address"`
	CreatedAt     time.Time      `json:"created_at"`
}

type AuditLogHandler struct{}

func NewAuditLogHandler() *AuditLogHandler {
	return &AuditLogHandler{}
}

// List returns paginated read-only audit log entries with filtering by action, target, actor, search, and date range.
func (h *AuditLogHandler) List(c *fiber.Ctx) error {
	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	fieldErrors := make(map[string]string)

	action := strings.TrimSpace(c.Query("action"))

	targetTable := strings.TrimSpace(c.Query("target_table"))
	if targetTable != "" && !allowedAuditTargetTables[targetTable] {
		fieldErrors["target_table"] = "Parameter target_table tidak valid. Pilihan: admins, reports, inventories, handovers, revoked_tokens."
	}

	rawAdminID := strings.TrimSpace(c.Query("admin_id"))
	var adminFilterID *uint
	filterSystem := false
	if rawAdminID != "" {
		if strings.EqualFold(rawAdminID, "system") {
			filterSystem = true
		} else {
			uid, ok := utils.ParseID(rawAdminID)
			if !ok {
				fieldErrors["admin_id"] = "Parameter admin_id harus berupa angka ID yang valid atau 'system'."
			} else {
				adminFilterID = &uid
			}
		}
	}

	rawTargetID := strings.TrimSpace(c.Query("target_id"))
	var targetFilterID *uint
	if rawTargetID != "" {
		uid, ok := utils.ParseID(rawTargetID)
		if !ok {
			fieldErrors["target_id"] = "Parameter target_id harus berupa angka ID yang valid."
		} else {
			targetFilterID = &uid
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
	sortCol, ok := allowedAuditSortColumns[sortKey]
	if !ok {
		fieldErrors["sort"] = "Kolom sort tidak valid. Pilihan: created_at, action, target_table."
	}

	orderDir := strings.ToLower(strings.TrimSpace(c.Query("order", "desc")))
	if orderDir != "asc" && orderDir != "desc" {
		fieldErrors["order"] = "Parameter order harus 'asc' atau 'desc'."
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(c, fiber.StatusUnprocessableEntity, "VALIDATION_ERROR", "Parameter filter audit log tidak valid.", fieldErrors)
	}

	query := config.DB.Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("audit_logs.action = ?", action)
	}
	if targetTable != "" {
		query = query.Where("audit_logs.target_table = ?", targetTable)
	}
	if filterSystem {
		query = query.Where("audit_logs.admin_id IS NULL")
	} else if adminFilterID != nil {
		query = query.Where("audit_logs.admin_id = ?", *adminFilterID)
	}
	if targetFilterID != nil {
		query = query.Where("audit_logs.target_id = ?", *targetFilterID)
	}
	if dateFromPtr != nil {
		query = query.Where("audit_logs.created_at >= ?", *dateFromPtr)
	}
	if dateToPtr != nil {
		query = query.Where("audit_logs.created_at <= ?", *dateToPtr)
	}

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Joins("LEFT JOIN admins ON admins.id = audit_logs.admin_id").
			Where(
				"(audit_logs.action ILIKE ? OR audit_logs.target_table ILIKE ? OR COALESCE(audit_logs.ip_address, '') ILIKE ? OR CAST(audit_logs.target_id AS TEXT) ILIKE ? OR COALESCE(admins.name, '') ILIKE ? OR COALESCE(admins.username, '') ILIKE ?)",
				like, like, like, like, like, like,
			)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal menghitung jumlah entri audit log.", nil)
	}

	var rows []models.AuditLog
	offset := (page - 1) * limit
	if err := query.Select("audit_logs.*").
		Preload("Admin.Role").
		Order(sortCol + " " + strings.ToUpper(orderDir)).
		Limit(limit).
		Offset(offset).
		Find(&rows).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal memuat daftar audit log dari database.", nil)
	}

	items := make([]AuditLogItemResponse, 0, len(rows))
	for i := range rows {
		items = append(items, mapAuditLogItem(&rows[i]))
	}

	var totalPages int64
	if total > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}

	return utils.SendSuccessWithMeta(c, fiber.StatusOK, items, PaginationMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetByID returns a single immutable audit log entry by numeric ID.
func (h *AuditLogHandler) GetByID(c *fiber.Ctx) error {
	logID, ok := utils.ParseID(c.Params("id"))
	if !ok {
		return utils.SendError(c, fiber.StatusBadRequest, "INVALID_ID", "Parameter ID audit log tidak valid (harus berupa angka ID).", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var entry models.AuditLog
	if err := config.DB.Preload("Admin.Role").Where("id = ?", logID).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.SendError(c, fiber.StatusNotFound, "AUDIT_LOG_NOT_FOUND", "Entri audit log tidak ditemukan.", nil)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal mengambil detail audit log dari database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, mapAuditLogItem(&entry))
}

func mapAuditLogItem(entry *models.AuditLog) AuditLogItemResponse {
	actorName := "SYSTEM"
	actorUsername := ""
	actorRole := ""

	if entry.AdminID != nil {
		if entry.Admin != nil {
			actorName = entry.Admin.Name
			actorUsername = entry.Admin.Username
			actorRole = entry.Admin.Role.DisplayName
		} else {
			actorName = "Admin"
		}
	}

	return AuditLogItemResponse{
		ID:            entry.ID,
		AdminID:       entry.AdminID,
		ActorName:     actorName,
		ActorUsername: actorUsername,
		ActorRole:     actorRole,
		Action:        entry.Action,
		TargetTable:   entry.TargetTable,
		TargetID:      entry.TargetID,
		Payload:       entry.Payload,
		IPAddress:     entry.IPAddress,
		CreatedAt:     entry.CreatedAt,
	}
}
