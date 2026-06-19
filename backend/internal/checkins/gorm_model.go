package checkins

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusActive         Status = "active"
	StatusCheckedOut     Status = "checked_out"
	StatusAutoCheckedOut Status = "auto_checked_out"
)

type CheckIn struct {
	ID               uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID           uuid.UUID  `gorm:"column:user_id;type:uuid;not null"`
	LocationID       uuid.UUID  `gorm:"column:location_id;type:uuid;not null"`
	VisitDate        time.Time  `gorm:"column:visit_date;type:date;not null"`
	CheckedInAt      time.Time  `gorm:"column:checked_in_at;type:timestamptz;not null"`
	CheckedOutAt     *time.Time `gorm:"column:checked_out_at;type:timestamptz"`
	Status           Status     `gorm:"column:status;type:text;not null;default:active"`
	EntranceConsumed bool       `gorm:"column:entrance_consumed;type:boolean;not null;default:false"`
	Latitude         *float64   `gorm:"column:latitude;type:double precision"`
	Longitude        *float64   `gorm:"column:longitude;type:double precision"`
	CreatedAt        time.Time  `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt        time.Time  `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (CheckIn) TableName() string {
	return "check_ins"
}

func (s Status) IsActive() bool {
	return s == StatusActive
}
