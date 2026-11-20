package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AuditLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	AdminID     *uuid.UUID     `gorm:"type:uuid;index" json:"admin_id"`
	Admin       *Admin         `gorm:"foreignKey:AdminID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"admin,omitempty"`
	Action      string         `gorm:"type:varchar(50);not null;index" json:"action"`
	TargetTable string         `gorm:"type:varchar(50);not null;index" json:"target_table"`
	TargetID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_id"`
	Payload     datatypes.JSON `gorm:"type:jsonb" json:"payload"`
	IPAddress   *string        `gorm:"type:varchar(45)" json:"ip_address"`
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

func (a *AuditLog) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
