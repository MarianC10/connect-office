package friends

import (
	"time"

	"github.com/google/uuid"
)

type RequestStatus string

const (
	RequestStatusPending  RequestStatus = "pending"
	RequestStatusAccepted RequestStatus = "accepted"
	RequestStatusDeclined RequestStatus = "declined"
)

type FriendRequest struct {
	ID         uuid.UUID     `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	FromUserID uuid.UUID     `gorm:"column:from_user_id;type:uuid;not null"`
	ToUserID   uuid.UUID     `gorm:"column:to_user_id;type:uuid;not null"`
	Status     RequestStatus `gorm:"column:status;type:text;not null"`
	CreatedAt  time.Time     `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt  time.Time     `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`
}

func (FriendRequest) TableName() string {
	return "friend_requests"
}

type Friendship struct {
	UserAID   uuid.UUID `gorm:"column:user_a_id;type:uuid;primaryKey"`
	UserBID   uuid.UUID `gorm:"column:user_b_id;type:uuid;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
}

func (Friendship) TableName() string {
	return "friendships"
}
