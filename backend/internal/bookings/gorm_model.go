package bookings

import (
	"time"

	"github.com/google/uuid"
)

type BookingStatus string

const (
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusCancelled BookingStatus = "cancelled"
)

type Booking struct {
	ID          uuid.UUID     `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID     `gorm:"column:user_id;type:uuid;not null"`
	LocationID  uuid.UUID     `gorm:"column:location_id;type:uuid;not null"`
	BookingDate time.Time     `gorm:"column:booking_date;type:date;not null"`
	Status      BookingStatus `gorm:"column:status;type:text;not null;default:confirmed"`
	CreatedAt   time.Time     `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt   time.Time     `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (Booking) TableName() string {
	return "bookings"
}
