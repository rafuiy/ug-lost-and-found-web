package models

import (
	"time"
)

type Handover struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	ReportID          uint       `gorm:"uniqueIndex;not null" json:"report_id"`
	Report            *Report    `gorm:"foreignKey:ReportID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"report,omitempty"`
	InventoryID       uint       `gorm:"not null;index" json:"inventory_id"`
	Inventory         *Inventory `gorm:"foreignKey:InventoryID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"inventory,omitempty"`
	AdminID           uint       `gorm:"not null;index" json:"admin_id"`
	Admin             *Admin     `gorm:"foreignKey:AdminID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"admin,omitempty"`
	RecipientName     string     `gorm:"type:varchar(100);not null" json:"recipient_name"`
	RecipientNPM      string     `gorm:"type:varchar(15);not null" json:"recipient_npm"`
	HandoverProofPath string     `gorm:"type:varchar(255);not null" json:"-"`
	HandoverNotes     *string    `gorm:"type:text" json:"handover_notes"`
	VoidedAt          *time.Time `gorm:"index" json:"voided_at,omitempty"`
	VoidedBy          *uint      `gorm:"index" json:"voided_by,omitempty"`
	VoidReason        *string    `gorm:"type:text" json:"void_reason,omitempty"`
	CreatedAt         time.Time  `gorm:"index" json:"created_at"`
}

func (Handover) TableName() string {
	return "handovers"
}
