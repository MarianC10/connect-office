package users

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID `gorm:"column:id;type:uuid;primaryKey"`
	Email         *string   `gorm:"column:email;type:text"`
	EmailVerified bool      `gorm:"column:email_verified;not null;default:false"`
	CreatedAt     time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt     time.Time `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (User) TableName() string {
	return "users"
}
