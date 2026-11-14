package models

import (
	"log"

	"gorm.io/gorm"
)

func AutoMigrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&User{},
		&Role{},
		&Permission{},
		&AuditLog{},
	)
	if err != nil {
		log.Fatal("Failed to auto migrate models:", err)
	}
	log.Println("Auto migration completed successfully")
}
