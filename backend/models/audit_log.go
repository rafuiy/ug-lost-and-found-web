package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/datatypes"
)

type AuditLog struct {
	ID        uint                `gorm:"primaryKey" json:"id"`
	UserID    uint                `json:"user_id"`
	Action    string              `gorm:"type:varchar(50);not null" json:"action"`
	Entity    string              `gorm:"type:varchar(100);not null" json:"entity"`
	EntityID  uint                `json:"entity_id"`
	OldValue  datatypes.JSONType  `gorm:"type:jsonb" json:"old_value"`
	NewValue  datatypes.JSONType  `gorm:"type:jsonb" json:"new_value"`
	CreatedAt time.Time           `json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
