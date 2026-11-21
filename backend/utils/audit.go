package utils

import (
	"encoding/json"
	"errors"
	"fmt"

	"backend/models"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// RecordAuditLog writes an append-only audit trail entry to the database.
// Callers must never pass plaintext passwords, tokens, or private document contents inside payload.
func RecordAuditLog(
	db *gorm.DB,
	adminID *uint,
	action string,
	targetTable string,
	targetID uint,
	payload interface{},
	ipAddress string,
) error {
	if db == nil {
		return errors.New("database connection is not initialized")
	}

	rawPayload := []byte("{}")
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("marshal audit payload: %w", err)
		}
		rawPayload = b
	}

	var ipPtr *string
	if ipAddress != "" {
		ip := ipAddress
		ipPtr = &ip
	}

	entry := models.AuditLog{
		AdminID:     adminID,
		Action:      action,
		TargetTable: targetTable,
		TargetID:    targetID,
		Payload:     datatypes.JSON(rawPayload),
		IPAddress:   ipPtr,
	}

	if err := db.Create(&entry).Error; err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}
