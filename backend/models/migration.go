package models

import (
	"log"

	"gorm.io/gorm"
)

// AutoMigrate creates or updates all UGLF domain tables using GORM AutoMigrate.
func AutoMigrate(db *gorm.DB) error {
	err := db.AutoMigrate(
		&Permission{},
		&Role{},
		&Admin{},
		&RevokedToken{},
		&Report{},
		&Inventory{},
		&Handover{},
		&AuditLog{},
	)
	if err != nil {
		return err
	}
	log.Println("Auto migration completed successfully")
	return nil
}
