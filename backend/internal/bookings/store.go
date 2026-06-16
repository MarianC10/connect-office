package bookings

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Store interface {
	Create(ctx context.Context, b Booking) (Booking, error)
	ListConfirmedByUser(ctx context.Context, userID uuid.UUID) ([]Booking, error)
	GetByID(ctx context.Context, id uuid.UUID) (Booking, error)
	Cancel(ctx context.Context, id uuid.UUID) error
	CountConfirmedByLocationDate(ctx context.Context, locationID uuid.UUID, date time.Time) (int, error)
	HasConfirmedForUserOnDate(ctx context.Context, userID uuid.UUID, date time.Time) (bool, error)
	HasConfirmedAtLocationOnDate(ctx context.Context, userID, locationID uuid.UUID, date time.Time) (bool, error)
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) Create(ctx context.Context, b Booking) (Booking, error) {
	if err := s.db.WithContext(ctx).Create(&b).Error; err != nil {
		return Booking{}, fmt.Errorf("create booking: %w", err)
	}
	return b, nil
}

func (s *PostgresStore) ListConfirmedByUser(ctx context.Context, userID uuid.UUID) ([]Booking, error) {
	var items []Booking
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, BookingStatusConfirmed).
		Order("booking_date ASC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list bookings: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) GetByID(ctx context.Context, id uuid.UUID) (Booking, error) {
	var b Booking
	err := s.db.WithContext(ctx).First(&b, "id = ?", id).Error
	if err != nil {
		return Booking{}, fmt.Errorf("get booking %s: %w", id, err)
	}
	return b, nil
}

func (s *PostgresStore) Cancel(ctx context.Context, id uuid.UUID) error {
	res := s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("id = ? AND status = ?", id, BookingStatusConfirmed).
		Updates(map[string]any{
			"status":     BookingStatusCancelled,
			"updated_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return fmt.Errorf("cancel booking %s: %w", id, res.Error)
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *PostgresStore) CountConfirmedByLocationDate(ctx context.Context, locationID uuid.UUID, date time.Time) (int, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("location_id = ? AND booking_date = ? AND status = ?", locationID, date, BookingStatusConfirmed).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count bookings: %w", err)
	}
	return int(count), nil
}

func (s *PostgresStore) HasConfirmedForUserOnDate(ctx context.Context, userID uuid.UUID, date time.Time) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("user_id = ? AND booking_date = ? AND status = ?", userID, date, BookingStatusConfirmed).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check user booking: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) HasConfirmedAtLocationOnDate(ctx context.Context, userID, locationID uuid.UUID, date time.Time) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Booking{}).
		Where("user_id = ? AND location_id = ? AND booking_date = ? AND status = ?",
			userID, locationID, date, BookingStatusConfirmed).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check user booking at location: %w", err)
	}
	return count > 0, nil
}

func isUniqueViolation(err error) bool {
	return errors.Is(err, gorm.ErrDuplicatedKey)
}
