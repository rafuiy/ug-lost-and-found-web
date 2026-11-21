package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	InventoryStatusTersimpan = "Tersimpan"
	InventoryStatusDiambil   = "Diambil"
)

type Inventory struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	ItemName         string         `gorm:"type:varchar(100);not null" json:"item_name"`
	InternalCategory string         `gorm:"type:varchar(50);not null;index" json:"internal_category"`
	StorageLocker    string         `gorm:"type:varchar(60);not null;default:'Loker A-01 (Loket D)';index" json:"storage_locker"`
	FoundLocation    string         `gorm:"type:varchar(150);not null" json:"found_location"`
	FoundDatetime    time.Time      `gorm:"not null" json:"found_datetime"`
	ItemDetails      string         `gorm:"type:text;not null" json:"item_details"`
	FinderName       string         `gorm:"type:varchar(100);not null" json:"finder_name"`
	FinderContact    string         `gorm:"type:varchar(50);not null" json:"finder_contact"`
	PhotoURL         *string        `gorm:"type:text" json:"photo_url,omitempty"`
	Status           string         `gorm:"type:varchar(20);not null;default:'Tersimpan';index;check:status IN ('Tersimpan','Diambil')" json:"status"`
	CreatedAt        time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	DeletedBy        *uint          `gorm:"index" json:"-"`
	DeleteReason     *string        `gorm:"type:text" json:"-"`
}

func (Inventory) TableName() string {
	return "inventories"
}
