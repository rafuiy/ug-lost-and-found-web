package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type Handover struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ReportID          uuid.UUID  `gorm:"type:uuid;uniqueIndex;not null" json:"report_id"`
	Report            *Report    `gorm:"foreignKey:ReportID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"report,omitempty"`
	InventoryID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"inventory_id"`
	Inventory         *Inventory `gorm:"foreignKey:InventoryID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"inventory,omitempty"`
	AdminID           uuid.UUID  `gorm:"type:uuid;not null;index" json:"admin_id"`
	Admin             *Admin     `gorm:"foreignKey:AdminID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"admin,omitempty"`
	RecipientName     string     `gorm:"type:varchar(100);not null" json:"recipient_name"`
	RecipientNPM      string     `gorm:"type:varchar(15);not null" json:"recipient_npm"`
	HandoverProofPath string     `gorm:"type:varchar(255);not null" json:"-"`
	HandoverNotes     *string    `gorm:"type:text" json:"handover_notes"`
	VoidedAt          *time.Time `gorm:"index" json:"voided_at,omitempty"`
	VoidedBy          *uuid.UUID `gorm:"type:uuid;index" json:"voided_by,omitempty"`
	VoidReason        *string    `gorm:"type:text" json:"void_reason,omitempty"`
	CreatedAt         time.Time  `gorm:"index" json:"created_at"`
}

func (Handover) TableName() string {
	return "handovers"
}

func (h *Handover) BeforeCreate(_ *gorm.DB) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	return nil
}
