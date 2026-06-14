package subscriptions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/customer"
	"github.com/stripe/stripe-go/v81/subscription"
	"github.com/stripe/stripe-go/v81/webhook"
	"gorm.io/gorm"
)

type StripeGateway interface {
	EnsureCustomer(ctx context.Context, userID uuid.UUID, email, existingCustomerID string) (string, error)
	CreateCheckoutSession(ctx context.Context, userID uuid.UUID, plan PlanType, priceID, customerID, successURL, cancelURL string) (sessionID string, checkoutURL string, err error)
	GetCheckoutSession(ctx context.Context, sessionID string) (stripe.CheckoutSession, error)
	ConstructEvent(payload []byte, signature string) (stripe.Event, error)
}

type StripeClient struct {
	cfg Config
}

func NewStripeClient(cfg Config) *StripeClient {
	// Single-tenant app: the Stripe Go SDK uses a package-level API key.
	if cfg.SecretKey != "" {
		stripe.Key = cfg.SecretKey
	}
	return &StripeClient{cfg: cfg}
}

func (c *StripeClient) EnsureCustomer(_ context.Context, userID uuid.UUID, email, existingCustomerID string) (string, error) {
	if existingCustomerID != "" {
		return existingCustomerID, nil
	}

	params := &stripe.CustomerParams{
		Metadata: map[string]string{
			"user_id": userID.String(),
		},
	}
	if email != "" {
		params.Email = stripe.String(email)
	}

	cust, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("create stripe customer: %w", err)
	}
	return cust.ID, nil
}

func (c *StripeClient) CreateCheckoutSession(_ context.Context, userID uuid.UUID, plan PlanType, priceID, customerID, successURL, cancelURL string) (string, string, error) {
	if priceID == "" {
		return "", "", ErrPlanNotConfigured
	}

	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(plan),
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
	}

	switch plan {
	case PlanEntrances10:
		params.Mode = stripe.String(string(stripe.CheckoutSessionModePayment))
	case PlanMonthly, PlanYearly:
		params.Mode = stripe.String(string(stripe.CheckoutSessionModeSubscription))
	default:
		return "", "", ErrInvalidPlanType
	}

	sess, err := session.New(params)
	if err != nil {
		return "", "", fmt.Errorf("create checkout session: %w", err)
	}
	return sess.ID, sess.URL, nil
}

func (c *StripeClient) GetCheckoutSession(_ context.Context, sessionID string) (stripe.CheckoutSession, error) {
	sess, err := session.Get(sessionID, nil)
	if err != nil {
		return stripe.CheckoutSession{}, fmt.Errorf("get checkout session: %w", err)
	}
	return *sess, nil
}

func (c *StripeClient) ConstructEvent(payload []byte, signature string) (stripe.Event, error) {
	event, err := webhook.ConstructEventWithOptions(payload, signature, c.cfg.WebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		return stripe.Event{}, fmt.Errorf("%w: %v", ErrWebhookVerification, err)
	}
	return event, nil
}

func (s *Service) activateFromCheckoutSession(ctx context.Context, sess stripe.CheckoutSession) error {
	if sess.ID != "" {
		full, err := s.stripe.GetCheckoutSession(ctx, sess.ID)
		if err != nil {
			return err
		}
		sess = full
	}

	if sess.Metadata == nil {
		return fmt.Errorf("checkout session missing metadata")
	}

	userID, err := uuid.Parse(sess.Metadata["user_id"])
	if err != nil {
		return fmt.Errorf("invalid user_id metadata: %w", err)
	}

	plan := PlanType(sess.Metadata["plan_type"])
	if !IsValidPlanType(plan) {
		return ErrInvalidPlanType
	}

	_, err = s.store.GetByCheckoutSessionID(ctx, sess.ID)
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	_, err = s.store.GetActiveByUserID(ctx, userID)
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	now := time.Now().UTC()
	sub := UserSubscription{
		UserID:                  userID,
		PlanType:                plan,
		Status:                  StatusActive,
		StartsAt:                now,
		StripeCheckoutSessionID: stripeString(sess.ID),
	}

	switch plan {
	case PlanEntrances10:
		remaining := EntrancesPackSize
		sub.EntrancesRemaining = &remaining
		if sess.PaymentIntent != nil {
			sub.StripePaymentIntentID = stripeString(sess.PaymentIntent.ID)
		}
	case PlanMonthly, PlanYearly:
		if sess.Subscription != nil {
			sub.StripeSubscriptionID = stripeString(sess.Subscription.ID)
			stripeSub, err := subscription.Get(sess.Subscription.ID, nil)
			if err != nil {
				return fmt.Errorf("load stripe subscription: %w", err)
			}
			expires := time.Unix(stripeSub.CurrentPeriodEnd, 0).UTC()
			sub.ExpiresAt = &expires
		}
	}

	_, err = s.store.Create(ctx, sub)
	if errors.Is(err, ErrDuplicateCheckoutSession) {
		return nil
	}
	if isUniqueViolation(err) {
		return nil
	}
	return err
}

func (s *Service) syncStripeSubscription(ctx context.Context, stripeSub stripe.Subscription, status Status) error {
	sub, err := s.store.GetByStripeSubscriptionID(ctx, stripeSub.ID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	sub.Status = status
	expires := time.Unix(stripeSub.CurrentPeriodEnd, 0).UTC()
	sub.ExpiresAt = &expires
	return s.store.Update(ctx, sub)
}

func stripeString(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func decodeStripeObject[T any](event stripe.Event) (T, error) {
	var out T
	if err := json.Unmarshal(event.Data.Raw, &out); err != nil {
		return out, fmt.Errorf("decode stripe event: %w", err)
	}
	return out, nil
}
