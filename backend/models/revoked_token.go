package models

import (
	"time"

	"gorm.io/gorm"
)

type RevokedToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	JTI       string    `gorm:"type:varchar(64);uniqueIndex;not null" json:"jti"`
	AdminID   uint      `gorm:"not null;index" json:"admin_id"`
	ExpiresAt time.Time `gorm:"not null;index" json:"expires_at"`
	RevokedAt time.Time `gorm:"not null" json:"revoked_at"`
}

func (RevokedToken) TableName() string {
	return "revoked_tokens"
}

func (r *RevokedToken) BeforeCreate(_ *gorm.DB) error {
	if r.RevokedAt.IsZero() {
		r.RevokedAt = time.Now()
	}
	return nil
}
