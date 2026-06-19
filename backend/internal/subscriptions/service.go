package subscriptions

import (
	"context"
	"errors"
	"fmt"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/gorm"
)

type UserProvisioner interface {
	UpsertFromPrincipal(ctx context.Context, p auth.Principal) (users.User, error)
	GetStripeCustomerID(ctx context.Context, userID uuid.UUID) (string, error)
	SetStripeCustomerID(ctx context.Context, userID uuid.UUID, customerID string) error
}

type Service struct {
	store  Store
	users  UserProvisioner
	stripe StripeGateway
	cfg    Config
}

var (
	ErrActiveSubscriptionExists  = errors.New("you already have an active subscription")
	ErrDuplicateCheckoutSession  = errors.New("subscription already exists for checkout session")
	ErrInvalidPlanType           = errors.New("invalid plan type")
	ErrInvalidRedirectURL        = errors.New("invalid redirect url")
	ErrStripeNotConfigured       = errors.New("stripe is not configured")
	ErrPlanNotConfigured         = errors.New("subscription plan is not configured for checkout")
	ErrWebhookVerification       = errors.New("webhook verification failed")
	ErrNoEntrancesRemaining      = errors.New("no entrances remaining")
)

func NewService(store Store, users UserProvisioner, stripe StripeGateway, cfg Config) *Service {
	return &Service{
		store:  store,
		users:  users,
		stripe: stripe,
		cfg:    cfg,
	}
}

func (s *Service) Enabled() bool {
	return s.cfg.Enabled
}

func (s *Service) ListPlans(ctx context.Context) ([]PlanResponse, error) {
	plans, err := s.store.ListActivePlans(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PlanResponse, 0, len(plans))
	for _, plan := range plans {
		out = append(out, toPlanResponse(plan))
	}
	return out, nil
}

func (s *Service) GetMine(ctx context.Context, p auth.Principal) (*MySubscriptionResponse, error) {
	sub, err := s.store.GetActiveByUserID(ctx, p.UserID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get active subscription: %w", err)
	}

	plan, err := s.store.GetPlanByType(ctx, sub.PlanType)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		resp := MySubscriptionResponse{
			PlanType:           string(sub.PlanType),
			Status:             string(sub.Status),
			EntrancesRemaining: sub.EntrancesRemaining,
			EntrancesTotal:     entrancesTotalForPlan(sub.PlanType),
			StartsAt:           sub.StartsAt,
			ExpiresAt:          sub.ExpiresAt,
			Perks:              []string{"Plan details unavailable"},
		}
		return &resp, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load plan for subscription: %w", err)
	}

	resp := toMySubscriptionResponse(sub, plan)
	return &resp, nil
}

func (s *Service) CreateCheckout(ctx context.Context, p auth.Principal, req CheckoutRequest) (CheckoutResponse, error) {
	if !s.cfg.StripeConfigured() {
		return CheckoutResponse{}, ErrStripeNotConfigured
	}

	plan := PlanType(req.PlanType)
	if !IsValidPlanType(plan) {
		return CheckoutResponse{}, ErrInvalidPlanType
	}

	successURL, err := resolveCheckoutRedirectURL(req.SuccessURL, s.cfg.SuccessURL)
	if err != nil {
		return CheckoutResponse{}, err
	}
	cancelURL, err := resolveCheckoutRedirectURL(req.CancelURL, s.cfg.CancelURL)
	if err != nil {
		return CheckoutResponse{}, err
	}

	dbPlan, err := s.store.GetPlanByType(ctx, plan)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return CheckoutResponse{}, ErrInvalidPlanType
	}
	if err != nil {
		return CheckoutResponse{}, err
	}
	if dbPlan.StripePriceID == "" {
		return CheckoutResponse{}, ErrPlanNotConfigured
	}

	if _, err := s.users.UpsertFromPrincipal(ctx, p); err != nil {
		return CheckoutResponse{}, fmt.Errorf("provision user: %w", err)
	}

	if _, err := s.store.GetActiveByUserID(ctx, p.UserID); err == nil {
		return CheckoutResponse{}, ErrActiveSubscriptionExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return CheckoutResponse{}, err
	}

	existingCustomerID, err := s.users.GetStripeCustomerID(ctx, p.UserID)
	if err != nil {
		return CheckoutResponse{}, fmt.Errorf("load stripe customer: %w", err)
	}

	customerID, err := s.stripe.EnsureCustomer(ctx, p.UserID, p.Email, existingCustomerID)
	if err != nil {
		return CheckoutResponse{}, err
	}

	if existingCustomerID == "" {
		if err := s.users.SetStripeCustomerID(ctx, p.UserID, customerID); err != nil {
			return CheckoutResponse{}, fmt.Errorf("save stripe customer: %w", err)
		}
	}

	_, checkoutURL, err := s.stripe.CreateCheckoutSession(ctx, p.UserID, plan, dbPlan.StripePriceID, customerID, successURL, cancelURL)
	if err != nil {
		return CheckoutResponse{}, err
	}

	return CheckoutResponse{CheckoutURL: checkoutURL}, nil
}

func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	if !s.cfg.WebhookConfigured() {
		return ErrStripeNotConfigured
	}

	event, err := s.stripe.ConstructEvent(payload, signature)
	if err != nil {
		return err
	}

	switch event.Type {
	case "checkout.session.completed":
		sess, err := decodeStripeObject[stripe.CheckoutSession](event)
		if err != nil {
			return err
		}
		return s.activateFromCheckoutSession(ctx, sess)
	case "customer.subscription.updated":
		stripeSub, err := decodeStripeObject[stripe.Subscription](event)
		if err != nil {
			return err
		}
		status := StatusActive
		if stripeSub.Status == stripe.SubscriptionStatusCanceled ||
			stripeSub.Status == stripe.SubscriptionStatusUnpaid ||
			stripeSub.Status == stripe.SubscriptionStatusIncompleteExpired {
			status = StatusCancelled
		}
		return s.syncStripeSubscription(ctx, stripeSub, status)
	case "customer.subscription.deleted":
		stripeSub, err := decodeStripeObject[stripe.Subscription](event)
		if err != nil {
			return err
		}
		return s.syncStripeSubscription(ctx, stripeSub, StatusCancelled)
	default:
		return nil
	}
}
