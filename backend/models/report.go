package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

const (
	ReportStatusBelumAda        = "Belum Ada"
	ReportStatusPerluVerifikasi = "Perlu Verifikasi"
	ReportStatusSelesai         = "Selesai"
	ReportStatusDitolak         = "Ditolak"
	ReportStatusDibatalkan      = "Dibatalkan"
)

type Report struct {
	ID                     uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	TicketCode             string     `gorm:"type:varchar(12);uniqueIndex;not null" json:"ticket_code"`
	ReporterName           string     `gorm:"type:varchar(100);not null" json:"reporter_name"`
	ReporterEmail          string     `gorm:"type:varchar(100);not null" json:"reporter_email"`
	NPM                    string     `gorm:"type:varchar(15);not null;index" json:"npm"`
	PhoneNumber            string     `gorm:"type:varchar(20);not null" json:"phone_number"`
	ItemName               string     `gorm:"type:varchar(100);not null" json:"item_name"`
	Category               string     `gorm:"type:varchar(50);not null;default:'Lainnya';index" json:"category"`
	LossLocation           string     `gorm:"type:varchar(150);not null" json:"loss_location"`
	LossDatetime           time.Time  `gorm:"not null" json:"loss_datetime"`
	ItemDescription        string     `gorm:"type:text;not null" json:"item_description"`
	SecretTraits           string     `gorm:"type:text;not null" json:"secret_traits"`
	KtmKrsPath             string     `gorm:"type:varchar(255);not null" json:"-"`
	ItemImagePath          *string    `gorm:"type:varchar(255)" json:"-"`
	Status                 string     `gorm:"type:varchar(30);not null;default:'Belum Ada';index;check:status IN ('Belum Ada','Perlu Verifikasi','Selesai','Ditolak','Dibatalkan')" json:"status"`
	IsStale                bool       `gorm:"not null;default:false;index" json:"is_stale"`
	RestoredAt             *time.Time `gorm:"index" json:"restored_at"`
	AdminNotes             *string    `gorm:"type:text" json:"admin_notes"`
	RejectionReason        *string    `gorm:"type:text" json:"rejection_reason"`
	CancelledFrom          *string    `gorm:"type:varchar(30)" json:"cancelled_from,omitempty"`
	CancelledBy            *string    `gorm:"type:varchar(100)" json:"cancelled_by,omitempty"`
	CancelReason           *string    `gorm:"type:text" json:"cancel_reason,omitempty"`
	CancelEmailType        *string    `gorm:"type:varchar(40)" json:"cancel_email_type,omitempty"`
	ResubmitToken          *string    `gorm:"type:varchar(128);index" json:"-"`
	ResubmitTokenExpiresAt *time.Time `json:"-"`
	ResubmitTokenUsedAt    *time.Time `json:"-"`
	ReopenedFromTicket     *string    `gorm:"type:varchar(12);index" json:"reopened_from_ticket,omitempty"`
	MatchedInventoryID     *uuid.UUID `gorm:"type:uuid;index" json:"matched_inventory_id"`
	MatchedInventory       *Inventory `gorm:"foreignKey:MatchedInventoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"matched_inventory,omitempty"`
	CreatedAt              time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	Handover               *Handover  `gorm:"foreignKey:ReportID" json:"handover,omitempty"`
}

func (Report) TableName() string {
	return "reports"
}

func (r *Report) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
