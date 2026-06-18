package chat

import (
	"time"

	"github.com/google/uuid"
)

type Conversation struct {
	ID        uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	UserAID   uuid.UUID `gorm:"column:user_a_id;type:uuid;not null"`
	UserBID   uuid.UUID `gorm:"column:user_b_id;type:uuid;not null"`
	CreatedAt time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
}

func (Conversation) TableName() string {
	return "conversations"
}

type Message struct {
	ID                uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	ConversationID    uuid.UUID `gorm:"column:conversation_id;type:uuid;not null"`
	SenderID          uuid.UUID `gorm:"column:sender_id;type:uuid;not null"`
	Body              string    `gorm:"column:body;type:text;not null"`
	CreatedAt         time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	CiphertextVersion *int      `gorm:"column:ciphertext_version"`
}

func (Message) TableName() string {
	return "messages"
}
