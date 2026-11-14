package models

import "time"

type Role struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	Name        string        `gorm:"type:varchar(50);unique;not null" json:"name"`
	Description string        `gorm:"type:text" json:"description"`
	Permissions []Permission  `gorm:"many2many:role_permissions" json:"permissions"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

func (Role) TableName() string {
	return "roles"
}
