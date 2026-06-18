package users

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleMember = "member"
	RoleOwner  = "owner"
)

type User struct {
	ID               uuid.UUID `gorm:"column:id;type:uuid;primaryKey"`
	Email            *string   `gorm:"column:email;type:text"`
	EmailVerified    bool      `gorm:"column:email_verified;not null;default:false"`
	Role             string    `gorm:"column:role;type:text;not null;default:member"`
	StripeCustomerID *string   `gorm:"column:stripe_customer_id;type:text"`
	DisplayName      string    `gorm:"column:display_name;type:text;not null"`
	IsPublic         bool      `gorm:"column:is_public;not null;default:false"`
	AvatarURL        *string   `gorm:"column:avatar_url;type:text"`
	CreatedAt        time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt        time.Time `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func IsOwnerRole(role string) bool {
	return role == RoleOwner
}

func (User) TableName() string {
	return "users"
}
