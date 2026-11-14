package seeders

import (
	"log"

	"backend/models"
	"gorm.io/gorm"
)

func SeedAll(db *gorm.DB) {
	log.Println("Starting database seeders...")

	// Seed roles first
	SeedRoles(db)

	// Seed permissions
	SeedPermissions(db)

	// Seed users
	SeedUsers(db)

	log.Println("Seeders completed successfully")
}

func SeedRoles(db *gorm.DB) {
	roles := []models.Role{
		{Name: "admin", Description: "Administrator"},
		{Name: "user", Description: "Regular User"},
		{Name: "guest", Description: "Guest User"},
	}

	for _, role := range roles {
		if err := db.FirstOrCreate(&role, models.Role{Name: role.Name}).Error; err != nil {
			log.Println("Error seeding role:", err)
		}
	}

	log.Println("Roles seeded successfully")
}

func SeedPermissions(db *gorm.DB) {
	permissions := []models.Permission{
		{Name: "Create User", Slug: "create.user"},
		{Name: "Read User", Slug: "read.user"},
		{Name: "Update User", Slug: "update.user"},
		{Name: "Delete User", Slug: "delete.user"},
	}

	for _, perm := range permissions {
		if err := db.FirstOrCreate(&perm, models.Permission{Slug: perm.Slug}).Error; err != nil {
			log.Println("Error seeding permission:", err)
		}
	}

	log.Println("Permissions seeded successfully")
}

func SeedUsers(db *gorm.DB) {
	// Find admin role
	var adminRole models.Role
	if err := db.Where("name = ?", "admin").First(&adminRole).Error; err != nil {
		log.Println("Admin role not found:", err)
		return
	}

	users := []models.User{
		{
			Name:     "Administrator",
			Email:    "admin@uglf.com",
			Password: "hashed_password_here", // In production, hash this properly
			RoleID:   adminRole.ID,
			IsActive: true,
		},
	}

	for _, user := range users {
		if err := db.FirstOrCreate(&user, models.User{Email: user.Email}).Error; err != nil {
			log.Println("Error seeding user:", err)
		}
	}

	log.Println("Users seeded successfully")
}
