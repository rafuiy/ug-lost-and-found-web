package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RevokedToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	JTI       string    `gorm:"type:varchar(64);uniqueIndex;not null" json:"jti"`
	AdminID   uuid.UUID `gorm:"type:uuid;not null;index" json:"admin_id"`
	ExpiresAt time.Time `gorm:"not null;index" json:"expires_at"`
	RevokedAt time.Time `gorm:"not null" json:"revoked_at"`
}

func (RevokedToken) TableName() string {
	return "revoked_tokens"
}

func (r *RevokedToken) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	if r.RevokedAt.IsZero() {
		r.RevokedAt = time.Now()
	}
	return nil
}
