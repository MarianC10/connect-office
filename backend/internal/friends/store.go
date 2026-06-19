package friends

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/chat"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserProfile struct {
	ID          uuid.UUID
	DisplayName string
	IsPublic    bool
	AvatarURL   string
}

type Store interface {
	CreateRequest(ctx context.Context, fromUserID, toUserID uuid.UUID) (FriendRequest, error)
	ListPendingInbox(ctx context.Context, toUserID uuid.UUID) ([]FriendRequest, error)
	ListPendingOutgoing(ctx context.Context, fromUserID uuid.UUID) ([]FriendRequest, error)
	GetRequestByID(ctx context.Context, id uuid.UUID) (FriendRequest, error)
	AcceptRequest(ctx context.Context, id uuid.UUID, toUserID uuid.UUID) (FriendRequest, error)
	DeclineRequest(ctx context.Context, id uuid.UUID, toUserID uuid.UUID) error
	CancelRequest(ctx context.Context, id uuid.UUID, fromUserID uuid.UUID) error
	RemoveFriend(ctx context.Context, userID, friendID uuid.UUID) error
	ListFriends(ctx context.Context, userID uuid.UUID) ([]UserProfile, error)
	AreFriends(ctx context.Context, userA, userB uuid.UUID) (bool, error)
	HasPendingBetween(ctx context.Context, fromUserID, toUserID uuid.UUID) (bool, error)
}

type PostgresStore struct {
	db  *gorm.DB
	cfg users.Config
}

func NewPostgresStore(db *gorm.DB, cfg users.Config) *PostgresStore {
	return &PostgresStore{db: db, cfg: cfg}
}

func (s *PostgresStore) CreateRequest(ctx context.Context, fromUserID, toUserID uuid.UUID) (FriendRequest, error) {
	req := FriendRequest{
		FromUserID: fromUserID,
		ToUserID:   toUserID,
		Status:     RequestStatusPending,
	}
	if err := s.db.WithContext(ctx).Create(&req).Error; err != nil {
		if isUniqueViolation(err) {
			return FriendRequest{}, ErrPendingRequestExists
		}
		return FriendRequest{}, fmt.Errorf("create friend request: %w", err)
	}
	return req, nil
}

func (s *PostgresStore) ListPendingInbox(ctx context.Context, toUserID uuid.UUID) ([]FriendRequest, error) {
	var items []FriendRequest
	err := s.db.WithContext(ctx).
		Where("to_user_id = ? AND status = ?", toUserID, RequestStatusPending).
		Order("created_at DESC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list inbox: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) ListPendingOutgoing(ctx context.Context, fromUserID uuid.UUID) ([]FriendRequest, error) {
	var items []FriendRequest
	err := s.db.WithContext(ctx).
		Where("from_user_id = ? AND status = ?", fromUserID, RequestStatusPending).
		Order("created_at DESC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list outgoing: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) GetRequestByID(ctx context.Context, id uuid.UUID) (FriendRequest, error) {
	var req FriendRequest
	err := s.db.WithContext(ctx).First(&req, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return FriendRequest{}, ErrRequestNotFound
	}
	if err != nil {
		return FriendRequest{}, fmt.Errorf("get request: %w", err)
	}
	return req, nil
}

func (s *PostgresStore) AcceptRequest(ctx context.Context, id uuid.UUID, toUserID uuid.UUID) (FriendRequest, error) {
	var accepted FriendRequest
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var req FriendRequest
		if err := tx.First(&req, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRequestNotFound
			}
			return err
		}
		if req.ToUserID != toUserID || req.Status != RequestStatusPending {
			return ErrRequestNotFound
		}

		a, b := canonicalPair(req.FromUserID, req.ToUserID)
		var friendshipCount int64
		if err := tx.Model(&Friendship{}).Where("user_a_id = ? AND user_b_id = ?", a, b).Count(&friendshipCount).Error; err != nil {
			return fmt.Errorf("check friendship: %w", err)
		}
		if friendshipCount == 0 {
			friendship := Friendship{UserAID: a, UserBID: b, CreatedAt: time.Now().UTC()}
			if err := tx.Create(&friendship).Error; err != nil {
				return fmt.Errorf("create friendship: %w", err)
			}
		}

		res := tx.Model(&FriendRequest{}).
			Where("id = ? AND status = ?", id, RequestStatusPending).
			Updates(map[string]any{
				"status":     RequestStatusAccepted,
				"updated_at": time.Now().UTC(),
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrRequestNotFound
		}

		req.Status = RequestStatusAccepted
		accepted = req
		return nil
	})
	if err != nil {
		return FriendRequest{}, err
	}

	chatStore := chat.NewPostgresStore(s.db, s.cfg)
	if _, err := chatStore.CreateConversationForPair(ctx, accepted.FromUserID, accepted.ToUserID); err != nil {
		return FriendRequest{}, err
	}
	return accepted, nil
}

func (s *PostgresStore) DeclineRequest(ctx context.Context, id uuid.UUID, toUserID uuid.UUID) error {
	res := s.db.WithContext(ctx).
		Model(&FriendRequest{}).
		Where("id = ? AND to_user_id = ? AND status = ?", id, toUserID, RequestStatusPending).
		Updates(map[string]any{
			"status":     RequestStatusDeclined,
			"updated_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return fmt.Errorf("decline request: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrRequestNotFound
	}
	return nil
}

func (s *PostgresStore) CancelRequest(ctx context.Context, id uuid.UUID, fromUserID uuid.UUID) error {
	res := s.db.WithContext(ctx).
		Model(&FriendRequest{}).
		Where("id = ? AND from_user_id = ? AND status = ?", id, fromUserID, RequestStatusPending).
		Updates(map[string]any{
			"status":     RequestStatusDeclined,
			"updated_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return fmt.Errorf("cancel request: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrRequestNotFound
	}
	return nil
}

func (s *PostgresStore) RemoveFriend(ctx context.Context, userID, friendID uuid.UUID) error {
	if userID == friendID {
		return ErrCannotFriendSelf
	}
	a, b := canonicalPair(userID, friendID)
	res := s.db.WithContext(ctx).
		Where("user_a_id = ? AND user_b_id = ?", a, b).
		Delete(&Friendship{})
	if res.Error != nil {
		return fmt.Errorf("remove friendship: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFriends
	}
	return nil
}

func (s *PostgresStore) ListFriends(ctx context.Context, userID uuid.UUID) ([]UserProfile, error) {
	var rows []struct {
		ID          uuid.UUID
		DisplayName string
		IsPublic    bool
		AvatarURL   *string
	}
	err := s.db.WithContext(ctx).Raw(`
		SELECT u.id, u.display_name, u.is_public, u.avatar_url
		FROM friendships f
		JOIN users u ON u.id = CASE
			WHEN f.user_a_id = ? THEN f.user_b_id
			ELSE f.user_a_id
		END
		WHERE f.user_a_id = ? OR f.user_b_id = ?
		ORDER BY u.display_name ASC
	`, userID, userID, userID).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("list friends: %w", err)
	}

	out := make([]UserProfile, 0, len(rows))
	for _, row := range rows {
		out = append(out, UserProfile{
			ID:          row.ID,
			DisplayName: row.DisplayName,
			IsPublic:    row.IsPublic,
			AvatarURL:   resolveAvatarURL(row.AvatarURL, s.cfg),
		})
	}
	return out, nil
}

func (s *PostgresStore) AreFriends(ctx context.Context, userA, userB uuid.UUID) (bool, error) {
	if userA == userB {
		return false, nil
	}
	a, b := canonicalPair(userA, userB)
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Friendship{}).
		Where("user_a_id = ? AND user_b_id = ?", a, b).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check friendship: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) HasPendingBetween(ctx context.Context, fromUserID, toUserID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&FriendRequest{}).
		Where("from_user_id = ? AND to_user_id = ? AND status = ?", fromUserID, toUserID, RequestStatusPending).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check pending request: %w", err)
	}
	return count > 0, nil
}

func canonicalPair(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if strings.Compare(a.String(), b.String()) < 0 {
		return a, b
	}
	return b, a
}

func resolveAvatarURL(avatarURL *string, cfg users.Config) string {
	return users.ResolveAvatarURL(avatarURL, cfg)
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}
