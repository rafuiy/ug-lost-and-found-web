package models

import (
	"time"

	"gorm.io/datatypes"
)

type AuditLog struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	AdminID     *uint          `gorm:"index" json:"admin_id"`
	Admin       *Admin         `gorm:"foreignKey:AdminID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"admin,omitempty"`
	Action      string         `gorm:"type:varchar(50);not null;index" json:"action"`
	TargetTable string         `gorm:"type:varchar(50);not null;index" json:"target_table"`
	TargetID    uint           `gorm:"not null;index" json:"target_id"`
	Payload     datatypes.JSON `gorm:"type:jsonb" json:"payload"`
	IPAddress   *string        `gorm:"type:varchar(45)" json:"ip_address"`
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
