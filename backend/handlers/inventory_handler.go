package handlers

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/middlewares"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var lockerPrefixRegex = regexp.MustCompile(`(?s)^\[(Loker [^\]]+)\]\s*(.*)$`)

type CreateInventoryRequest struct {
	ItemName         string  `json:"item_name"`
	InternalCategory string  `json:"internal_category"`
	StorageLocker    string  `json:"storage_locker"`
	FoundLocation    string  `json:"found_location"`
	FoundDatetime    string  `json:"found_datetime"`
	ItemDetails      string  `json:"item_details"`
	FinderName       string  `json:"finder_name"`
	FinderContact    string  `json:"finder_contact"`
	PhotoURL         *string `json:"photo_url"`
}

type UpdateInventoryRequest struct {
	ItemName         *string `json:"item_name"`
	InternalCategory *string `json:"internal_category"`
	StorageLocker    *string `json:"storage_locker"`
	FoundLocation    *string `json:"found_location"`
	FoundDatetime    *string `json:"found_datetime"`
	ItemDetails      *string `json:"item_details"`
	FinderName       *string `json:"finder_name"`
	FinderContact    *string `json:"finder_contact"`
	PhotoURL         *string `json:"photo_url"`
}

type DeleteInventoryRequest struct {
	Reason    string `json:"reason"`
	ConfirmID string `json:"confirm_id"`
}

type PaginationMeta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int64 `json:"total_pages"`
}

type InventoryHandler struct{}

func NewInventoryHandler() *InventoryHandler {
	return &InventoryHandler{}
}

var allowedInventorySortColumns = map[string]string{
	"created_at":     "created_at",
	"found_datetime": "found_datetime",
	"item_name":      "item_name",
	"status":         "status",
}

// List returns paginated inventories with optional status, category, location, search, and allowlisted sorting.
func (h *InventoryHandler) List(c *fiber.Ctx) error {
	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	fieldErrors := make(map[string]string)

	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != models.InventoryStatusTersimpan && status != models.InventoryStatusDiambil {
		fieldErrors["status"] = "Status inventori harus 'Tersimpan' atau 'Diambil'."
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
	sortCol, ok := allowedInventorySortColumns[sortKey]
	if !ok {
		fieldErrors["sort"] = "Kolom sort tidak valid. Pilihan yang diizinkan: created_at, found_datetime, item_name, status."
	}

	orderDir := strings.ToLower(strings.TrimSpace(c.Query("order", "desc")))
	if orderDir != "asc" && orderDir != "desc" {
		fieldErrors["order"] = "Parameter order harus 'asc' atau 'desc'."
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(c, fiber.StatusUnprocessableEntity, "VALIDATION_ERROR", "Parameter query inventori tidak valid.", fieldErrors)
	}

	query := config.DB.Model(&models.Inventory{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		query = query.Where("internal_category ILIKE ?", "%"+category+"%")
	}
	if location := strings.TrimSpace(c.Query("location")); location != "" {
		query = query.Where("found_location ILIKE ?", "%"+location+"%")
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"(item_name ILIKE ? OR internal_category ILIKE ? OR storage_locker ILIKE ? OR found_location ILIKE ? OR item_details ILIKE ? OR finder_name ILIKE ?)",
			like, like, like, like, like, like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal menghitung jumlah data inventori.", nil)
	}

	var items []models.Inventory
	offset := (page - 1) * limit
	if err := query.Order(sortCol + " " + strings.ToUpper(orderDir)).Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal memuat daftar inventori dari database.", nil)
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

// Create inserts a new found-item inventory record with status 'Tersimpan' and writes an audit log atomically.
func (h *InventoryHandler) Create(c *fiber.Ctx) error {
	var req CreateInventoryRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	itemName := strings.TrimSpace(req.ItemName)
	category := strings.TrimSpace(req.InternalCategory)
	storageLocker := strings.TrimSpace(req.StorageLocker)
	foundLocation := strings.TrimSpace(req.FoundLocation)
	itemDetails := strings.TrimSpace(req.ItemDetails)
	finderName := strings.TrimSpace(req.FinderName)
	finderContact := strings.TrimSpace(req.FinderContact)

	if storageLocker == "" {
		if m := lockerPrefixRegex.FindStringSubmatch(itemDetails); len(m) == 3 {
			storageLocker = strings.TrimSpace(m[1])
			if cleaned := strings.TrimSpace(m[2]); cleaned != "" {
				itemDetails = cleaned
			}
		} else {
			storageLocker = "Loker A-01 (Loket D)"
		}
	}

	fieldErrors := make(map[string]string)
	validateRequiredText(fieldErrors, "item_name", itemName, 100, "Nama barang")
	validateRequiredText(fieldErrors, "internal_category", category, 50, "Kategori internal")
	validateRequiredText(fieldErrors, "storage_locker", storageLocker, 60, "Lokasi loker penyimpanan")
	validateRequiredText(fieldErrors, "found_location", foundLocation, 150, "Lokasi ditemukan")
	validateRequiredText(fieldErrors, "item_details", itemDetails, 0, "Detail fisik barang")
	validateRequiredText(fieldErrors, "finder_name", finderName, 100, "Nama penemu")
	validateRequiredText(fieldErrors, "finder_contact", finderContact, 50, "Kontak penemu")

	foundDatetime, dtErr := utils.ParsePastDateTime(req.FoundDatetime)
	if dtErr != nil {
		fieldErrors["found_datetime"] = dtErr.Message
	}

	var photoURLPtr *string
	if req.PhotoURL != nil {
		if trimmedPhoto := strings.TrimSpace(*req.PhotoURL); trimmedPhoto != "" {
			photoURLPtr = &trimmedPhoto
		}
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data inventori tidak valid. Periksa field yang ditandai.",
			fieldErrors,
		)
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uint)
	if !ok || adminID == 0 {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	inv := models.Inventory{
		ItemName:         itemName,
		InternalCategory: category,
		StorageLocker:    storageLocker,
		FoundLocation:    foundLocation,
		FoundDatetime:    foundDatetime,
		ItemDetails:      itemDetails,
		FinderName:       finderName,
		FinderContact:    finderContact,
		PhotoURL:         photoURLPtr,
		Status:           models.InventoryStatusTersimpan,
	}

	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&inv).Error; err != nil {
			return err
		}
		return utils.RecordAuditLog(
			tx,
			&adminID,
			"INVENTORY_CREATED",
			"inventories",
			inv.ID,
			map[string]interface{}{
				"item_name":         inv.ItemName,
				"internal_category": inv.InternalCategory,
				"storage_locker":    inv.StorageLocker,
				"found_location":    inv.FoundLocation,
				"status":            inv.Status,
			},
			c.IP(),
		)
	}); err != nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "INVENTORY_CREATE_FAILED", "Gagal menyimpan data inventori ke database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusCreated, inv)
}

// GetByID returns a single internal inventory record by numeric ID.
func (h *InventoryHandler) GetByID(c *fiber.Ctx) error {
	invID, ok := utils.ParseID(c.Params("id"))
	if !ok {
		return utils.SendError(c, fiber.StatusBadRequest, "INVALID_ID", "Parameter ID inventori tidak valid (harus berupa angka ID).", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var inv models.Inventory
	if err := config.DB.Where("id = ?", invID).First(&inv).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.SendError(c, fiber.StatusNotFound, "INVENTORY_NOT_FOUND", "Data inventori tidak ditemukan.", nil)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_QUERY_ERROR", "Gagal mengambil detail inventori dari database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, inv)
}

// Update edits editable fields of a 'Tersimpan' inventory record (status changes are blocked here).
func (h *InventoryHandler) Update(c *fiber.Ctx) error {
	invID, ok := utils.ParseID(c.Params("id"))
	if !ok {
		return utils.SendError(c, fiber.StatusBadRequest, "INVALID_ID", "Parameter ID inventori tidak valid (harus berupa angka ID).", nil)
	}

	var req UpdateInventoryRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	if req.ItemName == nil &&
		req.InternalCategory == nil &&
		req.StorageLocker == nil &&
		req.FoundLocation == nil &&
		req.FoundDatetime == nil &&
		req.ItemDetails == nil &&
		req.FinderName == nil &&
		req.FinderContact == nil &&
		req.PhotoURL == nil {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Minimal satu field yang dapat diperbarui harus dikirim.",
			nil,
		)
	}

	fieldErrors := make(map[string]string)
	updates := make(map[string]interface{})

	if req.ItemName != nil {
		val := strings.TrimSpace(*req.ItemName)
		validateRequiredText(fieldErrors, "item_name", val, 100, "Nama barang")
		updates["item_name"] = val
	}
	if req.InternalCategory != nil {
		val := strings.TrimSpace(*req.InternalCategory)
		validateRequiredText(fieldErrors, "internal_category", val, 50, "Kategori internal")
		updates["internal_category"] = val
	}
	if req.StorageLocker != nil {
		val := strings.TrimSpace(*req.StorageLocker)
		validateRequiredText(fieldErrors, "storage_locker", val, 60, "Lokasi loker penyimpanan")
		updates["storage_locker"] = val
	}
	if req.FoundLocation != nil {
		val := strings.TrimSpace(*req.FoundLocation)
		validateRequiredText(fieldErrors, "found_location", val, 150, "Lokasi ditemukan")
		updates["found_location"] = val
	}
	if req.ItemDetails != nil {
		val := strings.TrimSpace(*req.ItemDetails)
		if req.StorageLocker == nil {
			if m := lockerPrefixRegex.FindStringSubmatch(val); len(m) == 3 {
				if lockerVal := strings.TrimSpace(m[1]); lockerVal != "" && len([]rune(lockerVal)) <= 60 {
					updates["storage_locker"] = lockerVal
				}
				if cleaned := strings.TrimSpace(m[2]); cleaned != "" {
					val = cleaned
				}
			}
		}
		validateRequiredText(fieldErrors, "item_details", val, 0, "Detail fisik barang")
		updates["item_details"] = val
	}
	if req.FinderName != nil {
		val := strings.TrimSpace(*req.FinderName)
		validateRequiredText(fieldErrors, "finder_name", val, 100, "Nama penemu")
		updates["finder_name"] = val
	}
	if req.FinderContact != nil {
		val := strings.TrimSpace(*req.FinderContact)
		validateRequiredText(fieldErrors, "finder_contact", val, 50, "Kontak penemu")
		updates["finder_contact"] = val
	}
	if req.PhotoURL != nil {
		val := strings.TrimSpace(*req.PhotoURL)
		if val == "" {
			updates["photo_url"] = nil
		} else {
			updates["photo_url"] = val
		}
	}
	if req.FoundDatetime != nil {
		parsedDT, dtErr := utils.ParsePastDateTime(*req.FoundDatetime)
		if dtErr != nil {
			fieldErrors["found_datetime"] = dtErr.Message
		} else {
			updates["found_datetime"] = parsedDT
		}
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Data pembaruan inventori tidak valid. Periksa field yang ditandai.",
			fieldErrors,
		)
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uint)
	if !ok || adminID == 0 {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	changedFields := make([]string, 0, len(updates))
	for k := range updates {
		changedFields = append(changedFields, k)
	}
	sort.Strings(changedFields)
	updates["updated_at"] = time.Now()

	var updated models.Inventory
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		var existing models.Inventory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", invID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &utils.AppError{
					Status:  fiber.StatusNotFound,
					Code:    "INVENTORY_NOT_FOUND",
					Message: "Data inventori tidak ditemukan.",
				}
			}
			return err
		}

		if existing.Status == models.InventoryStatusDiambil {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "INVENTORY_ALREADY_CLAIMED",
				Message: "Inventori yang sudah berstatus 'Diambil' tidak dapat diubah lagi.",
			}
		}

		if err := tx.Model(&models.Inventory{}).Where("id = ?", invID).Updates(updates).Error; err != nil {
			return err
		}

		if err := tx.Where("id = ?", invID).First(&updated).Error; err != nil {
			return err
		}

		return utils.RecordAuditLog(
			tx,
			&adminID,
			"INVENTORY_UPDATED",
			"inventories",
			invID,
			map[string]interface{}{
				"changed_fields": changedFields,
			},
			c.IP(),
		)
	})

	if txErr != nil {
		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "INVENTORY_UPDATE_FAILED", "Gagal memperbarui data inventori di database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, updated)
}

// Delete soft-deletes a 'Tersimpan' inventory record after exact ID confirmation,
// atomically unlinks any matched reports (reverting 'Perlu Verifikasi' -> 'Belum Ada'), and writes audit logs.
func (h *InventoryHandler) Delete(c *fiber.Ctx) error {
	rawID := strings.TrimSpace(c.Params("id"))
	invID, ok := utils.ParseID(rawID)
	if !ok {
		return utils.SendError(c, fiber.StatusBadRequest, "INVALID_ID", "Parameter ID inventori tidak valid (harus berupa angka ID).", nil)
	}

	var req DeleteInventoryRequest
	if appErr := utils.ParseJSONBody(c, &req); appErr != nil {
		return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
	}

	reason := strings.TrimSpace(req.Reason)
	confirmID := strings.TrimSpace(req.ConfirmID)

	fieldErrors := make(map[string]string)
	if reason == "" {
		fieldErrors["reason"] = "Alasan penghapusan inventori wajib diisi."
	}
	if confirmID == "" {
		fieldErrors["confirm_id"] = "Konfirmasi ID inventori wajib diisi."
	} else if confirmID != fmt.Sprint(invID) {
		fieldErrors["confirm_id"] = fmt.Sprintf("Konfirmasi ID inventori harus sama persis dengan '%d'.", invID)
	}

	if len(fieldErrors) > 0 {
		return utils.SendError(
			c,
			fiber.StatusUnprocessableEntity,
			"VALIDATION_ERROR",
			"Verifikasi penghapusan inventori gagal. Periksa alasan dan konfirmasi ID.",
			fieldErrors,
		)
	}

	adminID, ok := c.Locals(middlewares.LocalAdminID).(uint)
	if !ok || adminID == 0 {
		return utils.SendError(c, fiber.StatusUnauthorized, "UNAUTHORIZED", "Sesi admin tidak valid. Silakan login kembali.", nil)
	}

	if config.DB == nil {
		return utils.SendError(c, fiber.StatusInternalServerError, "DB_NOT_INITIALIZED", "Koneksi database belum siap.", nil)
	}

	var unlinkedTickets []string
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		var existing models.Inventory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", invID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &utils.AppError{
					Status:  fiber.StatusNotFound,
					Code:    "INVENTORY_NOT_FOUND",
					Message: "Data inventori tidak ditemukan atau sudah dihapus.",
				}
			}
			return err
		}

		if existing.Status == models.InventoryStatusDiambil {
			return &utils.AppError{
				Status:  fiber.StatusConflict,
				Code:    "INVENTORY_ALREADY_CLAIMED",
				Message: "Inventori yang sudah berstatus 'Diambil' tidak dapat dihapus agar histori serah terima tetap utuh.",
			}
		}

		now := time.Now()
		var linkedReports []models.Report
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("matched_inventory_id = ?", invID).Find(&linkedReports).Error; err != nil {
			return err
		}

		for _, rep := range linkedReports {
			unlinkedTickets = append(unlinkedTickets, rep.TicketCode)
			repUpdates := map[string]interface{}{
				"matched_inventory_id": nil,
				"updated_at":           now,
			}
			prevRepStatus := rep.Status
			newRepStatus := rep.Status
			if rep.Status == models.ReportStatusPerluVerifikasi {
				newRepStatus = models.ReportStatusBelumAda
				repUpdates["status"] = newRepStatus
				noteAddition := fmt.Sprintf("Tautan inventori [%d] dilepas karena inventori dihapus (%s) — status dikembalikan ke Belum Ada.", invID, reason)
				if rep.AdminNotes != nil && strings.TrimSpace(*rep.AdminNotes) != "" {
					repUpdates["admin_notes"] = strings.TrimSpace(*rep.AdminNotes) + " | " + noteAddition
				} else {
					repUpdates["admin_notes"] = noteAddition
				}
			}

			if err := tx.Model(&models.Report{}).Where("id = ?", rep.ID).Updates(repUpdates).Error; err != nil {
				return err
			}

			if prevRepStatus != newRepStatus {
				if err := utils.RecordAuditLog(
					tx,
					&adminID,
					"REPORT_STATUS_UPDATED",
					"reports",
					rep.ID,
					map[string]interface{}{
						"ticket_code":           rep.TicketCode,
						"previous_status":       prevRepStatus,
						"new_status":            newRepStatus,
						"unlinked_inventory_id": invID,
						"reason":                reason,
					},
					c.IP(),
				); err != nil {
					return err
				}
			}
		}

		if err := tx.Model(&models.Inventory{}).Where("id = ?", invID).Updates(map[string]interface{}{
			"deleted_by":    adminID,
			"delete_reason": reason,
			"updated_at":    now,
		}).Error; err != nil {
			return err
		}

		if err := tx.Delete(&existing).Error; err != nil {
			return err
		}

		return utils.RecordAuditLog(
			tx,
			&adminID,
			"INVENTORY_DELETED",
			"inventories",
			invID,
			map[string]interface{}{
				"item_name":             existing.ItemName,
				"internal_category":     existing.InternalCategory,
				"storage_locker":        existing.StorageLocker,
				"reason":                reason,
				"confirm_id":            confirmID,
				"deletion_mode":         "soft_delete",
				"unlinked_ticket_codes": unlinkedTickets,
			},
			c.IP(),
		)
	})

	if txErr != nil {
		var appErr *utils.AppError
		if errors.As(txErr, &appErr) {
			return utils.SendError(c, appErr.Status, appErr.Code, appErr.Message, appErr.Fields)
		}
		return utils.SendError(c, fiber.StatusInternalServerError, "INVENTORY_DELETE_FAILED", "Gagal menghapus data inventori di database.", nil)
	}

	return utils.SendSuccess(c, fiber.StatusOK, fiber.Map{
		"deleted_id":            invID,
		"deletion_mode":         "soft_delete",
		"reason":                reason,
		"unlinked_ticket_codes": unlinkedTickets,
	})
}

func validateRequiredText(fieldErrors map[string]string, fieldKey, value string, maxLen int, label string) {
	if value == "" {
		fieldErrors[fieldKey] = fmt.Sprintf("%s wajib diisi.", label)
		return
	}
	if maxLen > 0 && len([]rune(value)) > maxLen {
		fieldErrors[fieldKey] = fmt.Sprintf("%s maksimal %d karakter.", label, maxLen)
	}
}
