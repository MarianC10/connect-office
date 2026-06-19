package checkins

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Store interface {
	RunAutoCheckout(ctx context.Context, now time.Time, loadLocation func(context.Context, uuid.UUID) (locations.Location, error)) (int, error)
	GetActiveByUserID(ctx context.Context, userID uuid.UUID) (CheckIn, error)
	GetActiveByUserIDWithLocation(ctx context.Context, userID uuid.UUID) (CheckIn, string, error)
	ListActiveByLocationID(ctx context.Context, locationID uuid.UUID) ([]CheckIn, error)
	ListRecentByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]CheckIn, error)
	HasVisitOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error)
	EntranceConsumedOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error)
	CreateActiveCheckIn(ctx context.Context, record CheckIn, consumeEntrance bool, userID uuid.UUID, decrement func(context.Context, *gorm.DB, uuid.UUID) error) (CheckIn, error)
	CheckOut(ctx context.Context, id, userID uuid.UUID, at time.Time, status Status) (CheckIn, error)
	ListActiveForOwner(ctx context.Context, ownerID uuid.UUID, locationID *uuid.UUID) ([]activeOwnerRow, error)
	ListActiveByUserIDsAtLocations(ctx context.Context, userIDs []uuid.UUID, locationIDs []uuid.UUID) (map[uuid.UUID]CheckIn, error)
}

type activeOwnerRow struct {
	CheckInID    uuid.UUID `gorm:"column:check_in_id"`
	UserID       uuid.UUID `gorm:"column:user_id"`
	DisplayName  string    `gorm:"column:display_name"`
	Email        *string   `gorm:"column:email"`
	LocationID   uuid.UUID `gorm:"column:location_id"`
	LocationName string    `gorm:"column:location_name"`
	CheckedInAt  time.Time `gorm:"column:checked_in_at"`
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) RunAutoCheckout(ctx context.Context, now time.Time, loadLocation func(context.Context, uuid.UUID) (locations.Location, error)) (int, error) {
	var active []CheckIn
	if err := s.db.WithContext(ctx).Where("status = ?", StatusActive).Find(&active).Error; err != nil {
		return 0, fmt.Errorf("list active check-ins: %w", err)
	}
	updated := 0
	for _, ci := range active {
		loc, err := loadLocation(ctx, ci.LocationID)
		if err != nil {
			continue
		}
		_, closeAt, openToday, err := locations.OpenCloseInstants(loc, ci.VisitDate)
		if err != nil || !openToday {
			continue
		}
		if now.After(closeAt) {
			if err := s.db.WithContext(ctx).Model(&CheckIn{}).
				Where("id = ? AND status = ?", ci.ID, StatusActive).
				Updates(map[string]any{
					"status":         StatusAutoCheckedOut,
					"checked_out_at": closeAt,
					"updated_at":     now.UTC(),
				}).Error; err != nil {
				return updated, fmt.Errorf("auto checkout %s: %w", ci.ID, err)
			}
			updated++
		}
	}
	return updated, nil
}

func (s *PostgresStore) GetActiveByUserID(ctx context.Context, userID uuid.UUID) (CheckIn, error) {
	var ci CheckIn
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, StatusActive).
		First(&ci).Error
	if err != nil {
		return CheckIn{}, err
	}
	return ci, nil
}

func (s *PostgresStore) GetActiveByUserIDWithLocation(ctx context.Context, userID uuid.UUID) (CheckIn, string, error) {
	type row struct {
		CheckIn
		LocationName string
	}
	var r row
	err := s.db.WithContext(ctx).
		Table("check_ins c").
		Select("c.*, l.name AS location_name").
		Joins("JOIN locations l ON l.id = c.location_id").
		Where("c.user_id = ? AND c.status = ?", userID, StatusActive).
		First(&r).Error
	if err != nil {
		return CheckIn{}, "", err
	}
	return r.CheckIn, r.LocationName, nil
}

func (s *PostgresStore) ListActiveByLocationID(ctx context.Context, locationID uuid.UUID) ([]CheckIn, error) {
	var items []CheckIn
	err := s.db.WithContext(ctx).
		Where("location_id = ? AND status = ?", locationID, StatusActive).
		Order("checked_in_at ASC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list active check-ins: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) ListRecentByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]CheckIn, error) {
	if limit <= 0 {
		limit = 20
	}
	var items []CheckIn
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("checked_in_at DESC").
		Limit(limit).
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list check-ins: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) HasVisitOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&CheckIn{}).
		Where("user_id = ? AND location_id = ? AND visit_date = ?", userID, locationID, visitDate).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("count visits: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) EntranceConsumedOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&CheckIn{}).
		Where("user_id = ? AND location_id = ? AND visit_date = ? AND entrance_consumed = ?", userID, locationID, visitDate, true).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("count entrance consumed: %w", err)
	}
	return count > 0, nil
}

func (s *PostgresStore) CreateActiveCheckIn(
	ctx context.Context,
	record CheckIn,
	consumeEntrance bool,
	userID uuid.UUID,
	decrement func(context.Context, *gorm.DB, uuid.UUID) error,
) (CheckIn, error) {
	var created CheckIn
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if consumeEntrance {
			if err := decrement(ctx, tx, userID); err != nil {
				return err
			}
		}
		if err := tx.Create(&record).Error; err != nil {
			if isUniqueViolation(err) {
				return ErrAlreadyCheckedInElsewhere
			}
			return fmt.Errorf("create check-in: %w", err)
		}
		created = record
		return nil
	})
	if err != nil {
		return CheckIn{}, err
	}
	return created, nil
}

func (s *PostgresStore) CheckOut(ctx context.Context, id, userID uuid.UUID, at time.Time, status Status) (CheckIn, error) {
	var ci CheckIn
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&ci).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return CheckIn{}, ErrCheckInNotFound
		}
		return CheckIn{}, err
	}
	if !ci.Status.IsActive() {
		return ci, nil
	}
	ci.Status = status
	ci.CheckedOutAt = &at
	ci.UpdatedAt = at.UTC()
	if err := s.db.WithContext(ctx).Save(&ci).Error; err != nil {
		return CheckIn{}, fmt.Errorf("checkout: %w", err)
	}
	return ci, nil
}

func (s *PostgresStore) ListActiveForOwner(ctx context.Context, ownerID uuid.UUID, locationID *uuid.UUID) ([]activeOwnerRow, error) {
	q := s.db.WithContext(ctx).
		Table("check_ins c").
		Select(`c.id AS check_in_id, c.user_id, u.display_name, u.email,
			c.location_id, l.name AS location_name, c.checked_in_at`).
		Joins("JOIN locations l ON l.id = c.location_id").
		Joins("JOIN users u ON u.id = c.user_id").
		Where("l.owner_id = ? AND c.status = ?", ownerID, StatusActive)
	if locationID != nil {
		q = q.Where("c.location_id = ?", *locationID)
	}
	var rows []activeOwnerRow
	if err := q.Order("c.checked_in_at ASC").Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("list owner active check-ins: %w", err)
	}
	return rows, nil
}

func (s *PostgresStore) ListActiveByUserIDsAtLocations(ctx context.Context, userIDs []uuid.UUID, locationIDs []uuid.UUID) (map[uuid.UUID]CheckIn, error) {
	out := make(map[uuid.UUID]CheckIn)
	if len(userIDs) == 0 || len(locationIDs) == 0 {
		return out, nil
	}
	var items []CheckIn
	err := s.db.WithContext(ctx).
		Where("user_id IN ? AND location_id IN ? AND status = ?", userIDs, locationIDs, StatusActive).
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list active by users: %w", err)
	}
	for _, ci := range items {
		out[ci.UserID] = ci
	}
	return out, nil
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, gorm.ErrDuplicatedKey) ||
		strings.Contains(err.Error(), "duplicate key") ||
		strings.Contains(err.Error(), "unique constraint")
}
