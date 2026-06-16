package checkins

import (
	"time"

	"github.com/google/uuid"
)

type CheckIn struct {
	ID          uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID `gorm:"column:user_id;type:uuid;not null"`
	LocationID  uuid.UUID `gorm:"column:location_id;type:uuid;not null"`
	CheckInDate time.Time `gorm:"column:check_in_date;type:date;not null"`
	CheckedInAt time.Time `gorm:"column:checked_in_at;type:timestamptz;not null;autoCreateTime"`
}

func (CheckIn) TableName() string {
	return "check_ins"
}
