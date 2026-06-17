package social

import (
	"context"
	"fmt"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type VisibleBooking struct {
	UserID      uuid.UUID
	DisplayName string
	IsFriend    bool
	AvatarURL   string
}

type Store interface {
	ListVisibleBookings(ctx context.Context, viewerID, locationID uuid.UUID, date time.Time) ([]VisibleBooking, error)
}

type PostgresStore struct {
	db  *gorm.DB
	cfg users.Config
}

func NewPostgresStore(db *gorm.DB, cfg users.Config) *PostgresStore {
	return &PostgresStore{db: db, cfg: cfg}
}

func (s *PostgresStore) ListVisibleBookings(ctx context.Context, viewerID, locationID uuid.UUID, date time.Time) ([]VisibleBooking, error) {
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
		FROM bookings b
		JOIN users u ON u.id = b.user_id
		WHERE b.location_id = ?
		  AND b.booking_date = ?::date
		  AND b.status = 'confirmed'
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
		return nil, fmt.Errorf("list visible bookings: %w", err)
	}

	out := make([]VisibleBooking, 0, len(rows))
	for _, row := range rows {
		avatar := users.ResolveAvatarURL(row.AvatarURL, s.cfg)
		out = append(out, VisibleBooking{
			UserID:      row.UserID,
			DisplayName: row.DisplayName,
			IsFriend:    row.IsFriend,
			AvatarURL:   avatar,
		})
	}
	return out, nil
}
