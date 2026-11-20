package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	RoleAdmin        = "admin"
	RolePetugasLoket = "petugas_loket"
)

type Role struct {
	ID          uuid.UUID    `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string       `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	DisplayName string       `gorm:"type:varchar(100);not null" json:"display_name"`
	Description string       `gorm:"type:text" json:"description"`
	Permissions []Permission `gorm:"many2many:role_permissions;" json:"permissions,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

func (Role) TableName() string {
	return "roles"
}

func (r *Role) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
