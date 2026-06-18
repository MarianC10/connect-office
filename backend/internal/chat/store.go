package chat

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const defaultMessageLimit = 50

type FriendProfile struct {
	ID          uuid.UUID
	DisplayName string
	AvatarURL   string
}

type ConversationListItem struct {
	Conversation Conversation
	Friend       FriendProfile
	LastMessage  *Message
}

type Store interface {
	CreateConversationForPair(ctx context.Context, userA, userB uuid.UUID) (Conversation, error)
	CreateConversationForPairTx(tx *gorm.DB, userA, userB uuid.UUID) (Conversation, error)
	GetConversationByID(ctx context.Context, id uuid.UUID) (Conversation, error)
	GetConversationByPair(ctx context.Context, userA, userB uuid.UUID) (Conversation, error)
	ListConversations(ctx context.Context, userID uuid.UUID) ([]ConversationListItem, error)
	InsertMessage(ctx context.Context, conversationID, senderID uuid.UUID, body string) (Message, error)
	ListMessages(ctx context.Context, conversationID uuid.UUID, before *uuid.UUID, limit int) ([]Message, error)
	AreFriends(ctx context.Context, userA, userB uuid.UUID) (bool, error)
	GetFriendProfile(ctx context.Context, viewerID, friendID uuid.UUID) (FriendProfile, error)
}

type PostgresStore struct {
	db  *gorm.DB
	cfg users.Config
}

func NewPostgresStore(db *gorm.DB, cfg users.Config) *PostgresStore {
	return &PostgresStore{db: db, cfg: cfg}
}

func (s *PostgresStore) CreateConversationForPair(ctx context.Context, userA, userB uuid.UUID) (Conversation, error) {
	return s.CreateConversationForPairTx(s.db.WithContext(ctx), userA, userB)
}

func (s *PostgresStore) CreateConversationForPairTx(tx *gorm.DB, userA, userB uuid.UUID) (Conversation, error) {
	a, b := CanonicalPair(userA, userB)
	conv := Conversation{UserAID: a, UserBID: b, CreatedAt: time.Now().UTC()}
	if err := tx.Create(&conv).Error; err != nil {
		if isUniqueViolation(err) {
			var existing Conversation
			if findErr := tx.Where("user_a_id = ? AND user_b_id = ?", a, b).First(&existing).Error; findErr != nil {
				return Conversation{}, fmt.Errorf("find existing conversation: %w", findErr)
			}
			return existing, nil
		}
		return Conversation{}, fmt.Errorf("create conversation: %w", err)
	}
	return conv, nil
}

func (s *PostgresStore) GetConversationByID(ctx context.Context, id uuid.UUID) (Conversation, error) {
	var conv Conversation
	err := s.db.WithContext(ctx).First(&conv, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Conversation{}, ErrConversationNotFound
	}
	if err != nil {
		return Conversation{}, fmt.Errorf("get conversation: %w", err)
	}
	return conv, nil
}

func (s *PostgresStore) GetConversationByPair(ctx context.Context, userA, userB uuid.UUID) (Conversation, error) {
	a, b := CanonicalPair(userA, userB)
	var conv Conversation
	err := s.db.WithContext(ctx).
		Where("user_a_id = ? AND user_b_id = ?", a, b).
		First(&conv).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Conversation{}, ErrConversationNotFound
	}
	if err != nil {
		return Conversation{}, fmt.Errorf("get conversation by pair: %w", err)
	}
	return conv, nil
}

func (s *PostgresStore) ListConversations(ctx context.Context, userID uuid.UUID) ([]ConversationListItem, error) {
	var convs []Conversation
	err := s.db.WithContext(ctx).
		Where("user_a_id = ? OR user_b_id = ?", userID, userID).
		Order("created_at DESC").
		Find(&convs).Error
	if err != nil {
		return nil, fmt.Errorf("list conversations: %w", err)
	}

	items := make([]ConversationListItem, 0, len(convs))
	for _, conv := range convs {
		friendID, ok := OtherParticipant(conv, userID)
		if !ok {
			continue
		}
		friend, err := s.GetFriendProfile(ctx, userID, friendID)
		if err != nil {
			return nil, err
		}
		last, err := s.latestMessage(ctx, conv.ID)
		if err != nil {
			return nil, err
		}
		items = append(items, ConversationListItem{
			Conversation: conv,
			Friend:       friend,
			LastMessage:  last,
		})
	}

	sortConversationsByActivity(items)
	return items, nil
}

func (s *PostgresStore) latestMessage(ctx context.Context, conversationID uuid.UUID) (*Message, error) {
	var msg Message
	err := s.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID).
		Order("created_at DESC").
		Limit(1).
		First(&msg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("latest message: %w", err)
	}
	return &msg, nil
}

func sortConversationsByActivity(items []ConversationListItem) {
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if conversationActivity(items[j]).After(conversationActivity(items[i])) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
}

func conversationActivity(item ConversationListItem) time.Time {
	if item.LastMessage != nil {
		return item.LastMessage.CreatedAt
	}
	return item.Conversation.CreatedAt
}

func (s *PostgresStore) InsertMessage(ctx context.Context, conversationID, senderID uuid.UUID, body string) (Message, error) {
	msg := Message{
		ConversationID: conversationID,
		SenderID:       senderID,
		Body:           body,
	}
	if err := s.db.WithContext(ctx).Create(&msg).Error; err != nil {
		return Message{}, fmt.Errorf("insert message: %w", err)
	}
	return msg, nil
}

func (s *PostgresStore) ListMessages(ctx context.Context, conversationID uuid.UUID, before *uuid.UUID, limit int) ([]Message, error) {
	if limit <= 0 {
		limit = defaultMessageLimit
	}
	if limit > 100 {
		limit = 100
	}

	q := s.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID)

	if before != nil {
		var pivot Message
		if err := s.db.WithContext(ctx).First(&pivot, "id = ?", *before).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrInvalidMessage
			}
			return nil, fmt.Errorf("cursor message: %w", err)
		}
		q = q.Where("(created_at < ? OR (created_at = ? AND id < ?))",
			pivot.CreatedAt, pivot.CreatedAt, pivot.ID)
	}

	var messages []Message
	if err := q.Order("created_at DESC, id DESC").Limit(limit).Find(&messages).Error; err != nil {
		return nil, fmt.Errorf("list messages: %w", err)
	}
	return messages, nil
}

func (s *PostgresStore) AreFriends(ctx context.Context, userA, userB uuid.UUID) (bool, error) {
	if userA == userB {
		return false, nil
	}
	a, b := CanonicalPair(userA, userB)
	var count int64
	err := s.db.WithContext(ctx).Table("friendships").
		Where("user_a_id = ? AND user_b_id = ?", a, b).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check friendship: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) GetFriendProfile(ctx context.Context, viewerID, friendID uuid.UUID) (FriendProfile, error) {
	friends, err := s.AreFriends(ctx, viewerID, friendID)
	if err != nil {
		return FriendProfile{}, err
	}
	if !friends {
		return FriendProfile{}, ErrFriendNotFound
	}

	var row struct {
		ID          uuid.UUID
		DisplayName string
		AvatarURL   *string
	}
	err = s.db.WithContext(ctx).Raw(`
		SELECT id, display_name, avatar_url FROM users WHERE id = ?
	`, friendID).Scan(&row).Error
	if err != nil {
		return FriendProfile{}, fmt.Errorf("friend profile: %w", err)
	}
	if row.ID == uuid.Nil {
		return FriendProfile{}, ErrFriendNotFound
	}
	return FriendProfile{
		ID:          row.ID,
		DisplayName: row.DisplayName,
		AvatarURL:   users.ResolveAvatarURL(row.AvatarURL, s.cfg),
	}, nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}
