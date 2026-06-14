package users

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Store interface {
	UpsertFromPrincipal(ctx context.Context, p auth.Principal) (User, error)
	GetStripeCustomerID(ctx context.Context, userID uuid.UUID) (string, error)
	SetStripeCustomerID(ctx context.Context, userID uuid.UUID, customerID string) error
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) UpsertFromPrincipal(ctx context.Context, p auth.Principal) (User, error) {
	now := time.Now().UTC()
	emailTrim := strings.TrimSpace(p.Email)

	var existing User
	err := s.db.WithContext(ctx).Where("id = ?", p.UserID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		var emailPtr *string
		if emailTrim != "" {
			e := emailTrim
			emailPtr = &e
		}
		u := User{
			ID:            p.UserID,
			Email:         emailPtr,
			EmailVerified: p.EmailVerified,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := s.db.WithContext(ctx).Create(&u).Error; err != nil {
			return User{}, fmt.Errorf("create user: %w", err)
		}
		return u, nil
	}
	if err != nil {
		return User{}, fmt.Errorf("load user: %w", err)
	}

	updates := map[string]any{
		"email_verified": p.EmailVerified,
		"updated_at":     now,
	}
	if emailTrim != "" {
		e := emailTrim
		updates["email"] = &e
	}
	if err := s.db.WithContext(ctx).Model(&User{ID: p.UserID}).Updates(updates).Error; err != nil {
		return User{}, fmt.Errorf("update user: %w", err)
	}

	var out User
	if err := s.db.WithContext(ctx).First(&out, "id = ?", p.UserID).Error; err != nil {
		return User{}, fmt.Errorf("reload user: %w", err)
	}
	return out, nil
}

func (s *PostgresStore) GetStripeCustomerID(ctx context.Context, userID uuid.UUID) (string, error) {
	var u User
	err := s.db.WithContext(ctx).
		Select("stripe_customer_id").
		First(&u, "id = ?", userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load stripe customer id: %w", err)
	}
	if u.StripeCustomerID == nil {
		return "", nil
	}
	return *u.StripeCustomerID, nil
}

func (s *PostgresStore) SetStripeCustomerID(ctx context.Context, userID uuid.UUID, customerID string) error {
	customerID = strings.TrimSpace(customerID)
	if customerID == "" {
		return fmt.Errorf("stripe customer id is required")
	}
	res := s.db.WithContext(ctx).
		Model(&User{ID: userID}).
		Updates(map[string]any{
			"stripe_customer_id": customerID,
			"updated_at":         time.Now().UTC(),
		})
	if res.Error != nil {
		return fmt.Errorf("set stripe customer id: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
