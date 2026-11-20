package seeders

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"backend/config"
	"backend/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type roleSpec struct {
	name            string
	displayName     string
	description     string
	permissionSlugs []string
}

var defaultPermissions = []models.Permission{
	{Name: "Lihat Inventori", Slug: "inventories.read"},
	{Name: "Kelola Inventori", Slug: "inventories.write"},
	{Name: "Lihat Laporan", Slug: "reports.read"},
	{Name: "Ubah Status Laporan", Slug: "reports.update_status"},
	{Name: "Lihat File Privat", Slug: "reports.view_files"},
	{Name: "Pulihkan Laporan Lawas", Slug: "reports.restore"},
	{Name: "Buat Serah Terima", Slug: "handovers.create"},
	{Name: "Lihat Audit Log", Slug: "audit_logs.read"},
}

var defaultRoles = []roleSpec{
	{
		name:        models.RoleAdmin,
		displayName: "Admin",
		description: "Superadmin dengan akses penuh termasuk audit log dan pemulihan laporan lawas",
		permissionSlugs: []string{
			"inventories.read",
			"inventories.write",
			"reports.read",
			"reports.update_status",
			"reports.view_files",
			"reports.restore",
			"handovers.create",
			"audit_logs.read",
		},
	},
	{
		name:        models.RolePetugasLoket,
		displayName: "Petugas Loket",
		description: "Petugas loket operasional untuk inventori, review laporan, dan serah terima",
		permissionSlugs: []string{
			"inventories.read",
			"inventories.write",
			"reports.read",
			"reports.update_status",
			"reports.view_files",
			"handovers.create",
		},
	},
}

// SeedAll idempotently seeds essential MVP permissions, roles, and admin/petugas accounts.
func SeedAll(db *gorm.DB, cfg *config.AppConfig) error {
	if cfg == nil {
		var err error
		cfg, err = config.LoadConfig()
		if err != nil {
			return err
		}
	}

	log.Println("Starting database seeders...")

	permMap, err := seedPermissions(db)
	if err != nil {
		return fmt.Errorf("seed permissions: %w", err)
	}

	roleMap, err := seedRoles(db, permMap)
	if err != nil {
		return fmt.Errorf("seed roles: %w", err)
	}

	if err := seedAdmins(db, cfg, roleMap); err != nil {
		return fmt.Errorf("seed admins: %w", err)
	}

	log.Println("Seeders completed successfully")
	return nil
}

func seedPermissions(db *gorm.DB) (map[string]models.Permission, error) {
	permMap := make(map[string]models.Permission, len(defaultPermissions))
	for _, spec := range defaultPermissions {
		perm := models.Permission{
			Name: spec.Name,
			Slug: spec.Slug,
		}
		if err := db.Where(models.Permission{Slug: spec.Slug}).FirstOrCreate(&perm).Error; err != nil {
			return nil, err
		}
		permMap[perm.Slug] = perm
	}
	return permMap, nil
}

func seedRoles(db *gorm.DB, permMap map[string]models.Permission) (map[string]models.Role, error) {
	roleMap := make(map[string]models.Role, len(defaultRoles))
	for _, spec := range defaultRoles {
		role := models.Role{
			Name:        spec.name,
			DisplayName: spec.displayName,
			Description: spec.description,
		}
		if err := db.Where(models.Role{Name: spec.name}).FirstOrCreate(&role).Error; err != nil {
			return nil, err
		}

		// Keep display metadata synced across restarts.
		if role.DisplayName != spec.displayName || role.Description != spec.description {
			role.DisplayName = spec.displayName
			role.Description = spec.description
			if err := db.Model(&role).Updates(map[string]interface{}{
				"display_name": spec.displayName,
				"description":  spec.description,
			}).Error; err != nil {
				return nil, err
			}
		}

		perms := make([]models.Permission, 0, len(spec.permissionSlugs))
		for _, slug := range spec.permissionSlugs {
			p, ok := permMap[slug]
			if !ok {
				return nil, fmt.Errorf("missing seeded permission %q", slug)
			}
			perms = append(perms, p)
		}

		if err := db.Model(&role).Association("Permissions").Replace(perms); err != nil {
			return nil, err
		}

		roleMap[role.Name] = role
	}
	return roleMap, nil
}

func seedAdmins(db *gorm.DB, cfg *config.AppConfig, roleMap map[string]models.Role) error {
	accounts := []struct {
		email    string
		username string
		name     string
		roleName string
		password string
		envKey   string
	}{
		{
			email:    "admin@gmail.com",
			username: "admin",
			name:     "Administrator",
			roleName: models.RoleAdmin,
			password: cfg.SeedAdminPassword,
			envKey:   "SEED_ADMIN_PASSWORD",
		},
		{
			email:    "petugas@gmail.com",
			username: "petugas",
			name:     "Petugas Loket",
			roleName: models.RolePetugasLoket,
			password: cfg.SeedPetugasPassword,
			envKey:   "SEED_PETUGAS_PASSWORD",
		},
	}

	for _, acc := range accounts {
		role, ok := roleMap[acc.roleName]
		if !ok {
			return fmt.Errorf("missing seeded role %q", acc.roleName)
		}

		var existing models.Admin
		err := db.Where("LOWER(email) = ? OR LOWER(username) = ?", strings.ToLower(acc.email), strings.ToLower(acc.username)).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if strings.TrimSpace(acc.password) == "" {
			return fmt.Errorf("missing %s in environment for initial %s seeding", acc.envKey, acc.username)
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(acc.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		admin := models.Admin{
			Username:     acc.username,
			Email:        acc.email,
			PasswordHash: string(hash),
			Name:         acc.name,
			RoleID:       role.ID,
			IsActive:     true,
		}
		if err := db.Create(&admin).Error; err != nil {
			return err
		}
	}

	return nil
}
