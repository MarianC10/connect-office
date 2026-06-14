package subscriptions

import (
	"time"

	"github.com/google/uuid"
)

type PlanType string

const (
	PlanEntrances10 PlanType = "entrances_10"
	PlanMonthly     PlanType = "monthly"
	PlanYearly      PlanType = "yearly"
)

type Status string

const (
	StatusActive    Status = "active"
	StatusExpired   Status = "expired"
	StatusCancelled Status = "cancelled"
)

const EntrancesPackSize = 10

type UserSubscription struct {
	ID                      uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID                  uuid.UUID  `gorm:"column:user_id;type:uuid;not null"`
	PlanType                PlanType   `gorm:"column:plan_type;type:text;not null"`
	Status                  Status     `gorm:"column:status;type:text;not null;default:active"`
	EntrancesRemaining      *int       `gorm:"column:entrances_remaining;type:integer"`
	StartsAt                time.Time  `gorm:"column:starts_at;type:timestamptz;not null"`
	ExpiresAt               *time.Time `gorm:"column:expires_at;type:timestamptz"`
	StripeCheckoutSessionID *string    `gorm:"column:stripe_checkout_session_id;type:text"`
	StripeSubscriptionID    *string    `gorm:"column:stripe_subscription_id;type:text"`
	StripePaymentIntentID   *string    `gorm:"column:stripe_payment_intent_id;type:text"`
	CreatedAt               time.Time  `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt               time.Time  `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (UserSubscription) TableName() string {
	return "user_subscriptions"
}

func IsValidPlanType(v PlanType) bool {
	switch v {
	case PlanEntrances10, PlanMonthly, PlanYearly:
		return true
	default:
		return false
	}
}

type SubscriptionPlan struct {
	PlanType        PlanType  `gorm:"column:plan_type;type:text;primaryKey"`
	Name            string    `gorm:"column:name;type:text;not null"`
	Perks           []string  `gorm:"column:perks;type:jsonb;serializer:json;not null"`
	StripePriceID   string    `gorm:"column:stripe_price_id;type:text;not null"`
	Active          bool      `gorm:"column:active;not null;default:true"`
	SortOrder       int       `gorm:"column:sort_order;not null;default:0"`
	CreatedAt       time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt       time.Time `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}
