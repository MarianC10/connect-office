package checkins

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type VisibleCheckIn struct {
	UserID      uuid.UUID
	DisplayName string
	IsFriend    bool
	AvatarURL   string
}

type Store interface {
	Create(ctx context.Context, checkIn CheckIn) (CheckIn, error)
	HasCheckIn(ctx context.Context, userID, locationID uuid.UUID, date time.Time) (bool, error)
	ListVisible(ctx context.Context, viewerID, locationID uuid.UUID, date time.Time) ([]VisibleCheckIn, error)
}

type PostgresStore struct {
	db  *gorm.DB
	cfg users.Config
}

func NewPostgresStore(db *gorm.DB, cfg users.Config) *PostgresStore {
	return &PostgresStore{db: db, cfg: cfg}
}

func (s *PostgresStore) Create(ctx context.Context, checkIn CheckIn) (CheckIn, error) {
	if err := s.db.WithContext(ctx).Create(&checkIn).Error; err != nil {
		if isUniqueViolation(err) {
			return CheckIn{}, ErrAlreadyCheckedIn
		}
		return CheckIn{}, fmt.Errorf("create check-in: %w", err)
	}
	return checkIn, nil
}

func (s *PostgresStore) HasCheckIn(ctx context.Context, userID, locationID uuid.UUID, date time.Time) (bool, error) {
	dateKey := bookings.FormatBookingDate(date)
	var count int64
	err := s.db.WithContext(ctx).
		Model(&CheckIn{}).
		Where("user_id = ? AND location_id = ? AND check_in_date = ?", userID, locationID, dateKey).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("has check-in: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) ListVisible(ctx context.Context, viewerID, locationID uuid.UUID, date time.Time) ([]VisibleCheckIn, error) {
	dateKey := bookings.FormatBookingDate(date)
	var rows []struct {
		UserID      uuid.UUID
		DisplayName string
		IsFriend    bool
		AvatarURL   *string
	}
	err := s.db.WithContext(ctx).Raw(`
		SELECT
			u.id AS user_id,
			u.display_name,
			EXISTS (
				SELECT 1 FROM friendships f
				WHERE (f.user_a_id = ? AND f.user_b_id = u.id)
				   OR (f.user_b_id = ? AND f.user_a_id = u.id)
			) AS is_friend,
			u.avatar_url
		FROM check_ins c
		JOIN users u ON u.id = c.user_id
		WHERE c.location_id = ?
		  AND c.check_in_date = ?::date
		  AND (
			u.is_public = true
			OR EXISTS (
				SELECT 1 FROM friendships f
				WHERE (f.user_a_id = ? AND f.user_b_id = u.id)
				   OR (f.user_b_id = ? AND f.user_a_id = u.id)
			)
		  )
		ORDER BY is_friend DESC, u.display_name ASC
	`, viewerID, viewerID, locationID, dateKey, viewerID, viewerID).Scan(&rows).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []VisibleCheckIn{}, nil
		}
		return nil, fmt.Errorf("list visible check-ins: %w", err)
	}

	out := make([]VisibleCheckIn, 0, len(rows))
	for _, row := range rows {
		out = append(out, VisibleCheckIn{
			UserID:      row.UserID,
			DisplayName: row.DisplayName,
			IsFriend:    row.IsFriend,
			AvatarURL:   users.ResolveAvatarURL(row.AvatarURL, s.cfg),
		})
	}
	return out, nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}
