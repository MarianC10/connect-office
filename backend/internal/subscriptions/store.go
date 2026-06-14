package subscriptions

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Store interface {
	ListActivePlans(ctx context.Context) ([]SubscriptionPlan, error)
	GetPlanByType(ctx context.Context, planType PlanType) (SubscriptionPlan, error)
	GetActiveByUserID(ctx context.Context, userID uuid.UUID) (UserSubscription, error)
	GetByCheckoutSessionID(ctx context.Context, sessionID string) (UserSubscription, error)
	GetByStripeSubscriptionID(ctx context.Context, subscriptionID string) (UserSubscription, error)
	Create(ctx context.Context, sub UserSubscription) (UserSubscription, error)
	Update(ctx context.Context, sub UserSubscription) error
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) ListActivePlans(ctx context.Context) ([]SubscriptionPlan, error) {
	var plans []SubscriptionPlan
	err := s.db.WithContext(ctx).
		Where("active = ?", true).
		Order("sort_order ASC, plan_type ASC").
		Find(&plans).Error
	if err != nil {
		return nil, fmt.Errorf("list subscription plans: %w", err)
	}
	return plans, nil
}

func (s *PostgresStore) GetPlanByType(ctx context.Context, planType PlanType) (SubscriptionPlan, error) {
	var plan SubscriptionPlan
	err := s.db.WithContext(ctx).
		Where("plan_type = ? AND active = ?", planType, true).
		First(&plan).Error
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("get subscription plan %s: %w", planType, err)
	}
	return plan, nil
}

func (s *PostgresStore) GetActiveByUserID(ctx context.Context, userID uuid.UUID) (UserSubscription, error) {
	var sub UserSubscription
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, StatusActive).
		First(&sub).Error
	if err != nil {
		return UserSubscription{}, fmt.Errorf("get active subscription: %w", err)
	}
	return sub, nil
}

func (s *PostgresStore) GetByCheckoutSessionID(ctx context.Context, sessionID string) (UserSubscription, error) {
	var sub UserSubscription
	err := s.db.WithContext(ctx).
		Where("stripe_checkout_session_id = ?", sessionID).
		First(&sub).Error
	if err != nil {
		return UserSubscription{}, fmt.Errorf("get subscription by checkout session: %w", err)
	}
	return sub, nil
}

func (s *PostgresStore) GetByStripeSubscriptionID(ctx context.Context, subscriptionID string) (UserSubscription, error) {
	var sub UserSubscription
	err := s.db.WithContext(ctx).
		Where("stripe_subscription_id = ?", subscriptionID).
		First(&sub).Error
	if err != nil {
		return UserSubscription{}, fmt.Errorf("get subscription by stripe id: %w", err)
	}
	return sub, nil
}

func (s *PostgresStore) Create(ctx context.Context, sub UserSubscription) (UserSubscription, error) {
	if err := s.db.WithContext(ctx).Create(&sub).Error; err != nil {
		if isUniqueViolation(err) {
			return UserSubscription{}, ErrDuplicateCheckoutSession
		}
		return UserSubscription{}, fmt.Errorf("create subscription: %w", err)
	}
	return sub, nil
}

func isUniqueViolation(err error) bool {
	return errors.Is(err, gorm.ErrDuplicatedKey)
}

func (s *PostgresStore) Update(ctx context.Context, sub UserSubscription) error {
	sub.UpdatedAt = time.Now().UTC()
	if err := s.db.WithContext(ctx).Save(&sub).Error; err != nil {
		return fmt.Errorf("update subscription: %w", err)
	}
	return nil
}
