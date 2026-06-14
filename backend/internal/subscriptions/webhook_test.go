package subscriptions

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
)

func fakeStripeForSession(sess stripe.CheckoutSession) *fakeStripe {
	return &fakeStripe{
		checkoutSessions: map[string]stripe.CheckoutSession{
			sess.ID: sess,
		},
	}
}

func TestHandleWebhookRejectsInvalidSignature(t *testing.T) {
	svc := NewService(
		&fakeStore{plans: defaultFakePlans()},
		&fakeUsers{},
		&fakeStripe{constructError: ErrWebhookVerification},
		defaultTestConfig(),
	)

	err := svc.HandleWebhook(context.Background(), []byte(`{}`), "invalid")
	if !errors.Is(err, ErrWebhookVerification) {
		t.Fatalf("expected ErrWebhookVerification, got %v", err)
	}
}

func TestHandleWebhookRequiresWebhookConfig(t *testing.T) {
	cfg := defaultTestConfig()
	cfg.WebhookSecret = ""
	svc := NewService(&fakeStore{}, &fakeUsers{}, &fakeStripe{}, cfg)

	err := svc.HandleWebhook(context.Background(), []byte(`{}`), "sig")
	if !errors.Is(err, ErrStripeNotConfigured) {
		t.Fatalf("expected ErrStripeNotConfigured, got %v", err)
	}
}

func TestActivateFromCheckoutSession_IdempotentSession(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{
		plans: defaultFakePlans(),
		bySession: map[string]UserSubscription{
			"cs_existing": {UserID: userID, PlanType: PlanEntrances10},
		},
	}
	svc := NewService(store, &fakeUsers{}, fakeStripeForSession(stripe.CheckoutSession{
		ID: "cs_existing",
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(PlanEntrances10),
		},
	}), defaultTestConfig())

	err := svc.activateFromCheckoutSession(context.Background(), stripe.CheckoutSession{
		ID: "cs_existing",
	})
	if err != nil {
		t.Fatalf("expected nil for existing session, got %v", err)
	}
}

func TestActivateFromCheckoutSession_AlreadyActiveReturnsNil(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{
		plans: defaultFakePlans(),
		active: &UserSubscription{
			ID:       uuid.New(),
			UserID:   userID,
			PlanType: PlanMonthly,
			Status:   StatusActive,
		},
	}
	svc := NewService(store, &fakeUsers{}, fakeStripeForSession(stripe.CheckoutSession{
		ID: "cs_new",
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(PlanEntrances10),
		},
	}), defaultTestConfig())

	err := svc.activateFromCheckoutSession(context.Background(), stripe.CheckoutSession{
		ID: "cs_new",
	})
	if err != nil {
		t.Fatalf("expected nil when user already active, got %v", err)
	}
}

func TestActivateFromCheckoutSession_DuplicateKeyReturnsNil(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{
		plans:                    defaultFakePlans(),
		duplicateCreateSessionID: "cs_race",
	}
	svc := NewService(store, &fakeUsers{}, fakeStripeForSession(stripe.CheckoutSession{
		ID: "cs_race",
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(PlanEntrances10),
		},
	}), defaultTestConfig())

	err := svc.activateFromCheckoutSession(context.Background(), stripe.CheckoutSession{
		ID: "cs_race",
	})
	if err != nil {
		t.Fatalf("expected nil for duplicate checkout session, got %v", err)
	}
}

func TestActivateFromCheckoutSession_CreatesSubscription(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{plans: defaultFakePlans()}
	sess := stripe.CheckoutSession{
		ID: "cs_new",
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(PlanEntrances10),
		},
	}
	svc := NewService(store, &fakeUsers{}, fakeStripeForSession(sess), defaultTestConfig())

	err := svc.activateFromCheckoutSession(context.Background(), stripe.CheckoutSession{ID: "cs_new"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(store.created) != 1 {
		t.Fatalf("expected one created subscription, got %d", len(store.created))
	}
}

func TestHandleWebhookCheckoutSessionCompleted(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{plans: defaultFakePlans()}
	sess := stripe.CheckoutSession{
		ID: "cs_webhook",
		Metadata: map[string]string{
			"user_id":   userID.String(),
			"plan_type": string(PlanEntrances10),
		},
	}
	raw, err := json.Marshal(sess)
	if err != nil {
		t.Fatal(err)
	}

	stripeFake := fakeStripeForSession(sess)
	stripeFake.event = stripe.Event{
		Type: "checkout.session.completed",
		Data: &stripe.EventData{Raw: raw},
	}
	svc := NewService(store, &fakeUsers{}, stripeFake, defaultTestConfig())

	if err := svc.HandleWebhook(context.Background(), []byte(`{}`), "sig"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(store.created) != 1 {
		t.Fatalf("expected created subscription, got %d", len(store.created))
	}
}

func TestDecodeCheckoutSessionWithStringPaymentIntent(t *testing.T) {
	raw := []byte(`{"id":"cs_test","metadata":{"user_id":"550e8400-e29b-41d4-a716-446655440000","plan_type":"entrances_10"},"payment_intent":"pi_test123","mode":"payment"}`)
	sess, err := decodeStripeObjectFromRaw[stripe.CheckoutSession](raw)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if sess.ID != "cs_test" {
		t.Fatalf("unexpected id: %q", sess.ID)
	}
	if sess.Metadata["plan_type"] != "entrances_10" {
		t.Fatalf("unexpected metadata: %v", sess.Metadata)
	}
}

func TestDecodeCheckoutSessionWithStringSubscription(t *testing.T) {
	raw := []byte(`{"id":"cs_test","metadata":{"user_id":"550e8400-e29b-41d4-a716-446655440000","plan_type":"monthly"},"subscription":"sub_test123","mode":"subscription"}`)
	sess, err := decodeStripeObjectFromRaw[stripe.CheckoutSession](raw)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if sess.Subscription == nil {
		t.Fatal("expected subscription field")
	}
}

func decodeStripeObjectFromRaw[T any](raw []byte) (T, error) {
	var out T
	err := json.Unmarshal(raw, &out)
	return out, err
}

func TestStripeClientConstructEventRejectsInvalidSignature(t *testing.T) {
	client := NewStripeClient(Config{WebhookSecret: "whsec_test"})
	_, err := client.ConstructEvent([]byte(`{"id":"evt_test"}`), "invalid")
	if !errors.Is(err, ErrWebhookVerification) {
		t.Fatalf("expected ErrWebhookVerification, got %v", err)
	}
}
