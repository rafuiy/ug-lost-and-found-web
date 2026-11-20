package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	InventoryStatusTersimpan = "Tersimpan"
	InventoryStatusDiambil   = "Diambil"
)

type Inventory struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ItemName         string    `gorm:"type:varchar(100);not null" json:"item_name"`
	InternalCategory string    `gorm:"type:varchar(50);not null;index" json:"internal_category"`
	FoundLocation    string    `gorm:"type:varchar(150);not null" json:"found_location"`
	FoundDatetime    time.Time `gorm:"not null" json:"found_datetime"`
	ItemDetails      string    `gorm:"type:text;not null" json:"item_details"`
	FinderName       string    `gorm:"type:varchar(100);not null" json:"finder_name"`
	FinderContact    string    `gorm:"type:varchar(50);not null" json:"finder_contact"`
	Status           string    `gorm:"type:varchar(20);not null;default:'Tersimpan';index;check:status IN ('Tersimpan','Diambil')" json:"status"`
	CreatedAt        time.Time `gorm:"index" json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (Inventory) TableName() string {
	return "inventories"
}

func (i *Inventory) BeforeCreate(_ *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
