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
	UpdateProfile(ctx context.Context, userID uuid.UUID, displayName *string, isPublic *bool) (User, error)
	SetAvatarURL(ctx context.Context, userID uuid.UUID, avatarURL string) (User, error)
	SearchPublicByDisplayName(ctx context.Context, query string, limit int) ([]User, error)
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (User, error)
	GetByIDs(ctx context.Context, userIDs []uuid.UUID) ([]User, error)
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
		displayName := displayNameFromEmail(emailTrim)
		var emailPtr *string
		if emailTrim != "" {
			e := emailTrim
			emailPtr = &e
		}
		u := User{
			ID:            p.UserID,
			Email:         emailPtr,
			EmailVerified: p.EmailVerified,
			DisplayName:   displayName,
			IsPublic:      false,
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
	if strings.TrimSpace(existing.DisplayName) == "" {
		updates["display_name"] = displayNameFromEmail(emailTrim)
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

func (s *PostgresStore) UpdateProfile(ctx context.Context, userID uuid.UUID, displayName *string, isPublic *bool) (User, error) {
	updates := map[string]any{
		"updated_at": time.Now().UTC(),
	}
	if displayName != nil {
		trimmed := strings.TrimSpace(*displayName)
		if err := validateDisplayName(trimmed); err != nil {
			return User{}, err
		}
		updates["display_name"] = trimmed
	}
	if isPublic != nil {
		updates["is_public"] = *isPublic
	}
	res := s.db.WithContext(ctx).Model(&User{ID: userID}).Updates(updates)
	if res.Error != nil {
		return User{}, fmt.Errorf("update profile: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return User{}, gorm.ErrRecordNotFound
	}
	return s.GetByID(ctx, userID)
}

func (s *PostgresStore) SetAvatarURL(ctx context.Context, userID uuid.UUID, avatarURL string) (User, error) {
	avatarURL = strings.TrimSpace(avatarURL)
	if avatarURL == "" {
		return User{}, fmt.Errorf("avatar url is required")
	}
	res := s.db.WithContext(ctx).Model(&User{ID: userID}).Updates(map[string]any{
		"avatar_url": avatarURL,
		"updated_at": time.Now().UTC(),
	})
	if res.Error != nil {
		return User{}, fmt.Errorf("set avatar url: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return User{}, gorm.ErrRecordNotFound
	}
	return s.GetByID(ctx, userID)
}

func (s *PostgresStore) SearchPublicByDisplayName(ctx context.Context, query string, limit int) ([]User, error) {
	query = strings.TrimSpace(query)
	if limit <= 0 {
		limit = 20
	}
	var items []User
	err := s.db.WithContext(ctx).
		Where("is_public = true AND display_name ILIKE ?", "%"+query+"%").
		Order("display_name ASC").
		Limit(limit).
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("search users: %w", err)
	}
	return items, nil
}

func (s *PostgresStore) GetByEmail(ctx context.Context, email string) (User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var u User
	err := s.db.WithContext(ctx).
		Where("LOWER(email) = ?", email).
		First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}

func (s *PostgresStore) GetByID(ctx context.Context, userID uuid.UUID) (User, error) {
	var u User
	err := s.db.WithContext(ctx).First(&u, "id = ?", userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user: %w", err)
	}
	return u, nil
}

func (s *PostgresStore) GetByIDs(ctx context.Context, userIDs []uuid.UUID) ([]User, error) {
	if len(userIDs) == 0 {
		return []User{}, nil
	}
	var users []User
	if err := s.db.WithContext(ctx).Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return nil, fmt.Errorf("get users by ids: %w", err)
	}
	return users, nil
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
