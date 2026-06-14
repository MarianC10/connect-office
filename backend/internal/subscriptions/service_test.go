package subscriptions

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/gorm"
)

type fakeStore struct {
	active                   *UserSubscription
	bySession                map[string]UserSubscription
	byStripeSub              map[string]UserSubscription
	created                  []UserSubscription
	plans                    map[PlanType]SubscriptionPlan
	duplicateCreateSessionID string
}

func (f *fakeStore) ListActivePlans(ctx context.Context) ([]SubscriptionPlan, error) {
	var out []SubscriptionPlan
	for _, plan := range f.plans {
		if plan.Active {
			out = append(out, plan)
		}
	}
	return out, nil
}

func (f *fakeStore) GetPlanByType(ctx context.Context, planType PlanType) (SubscriptionPlan, error) {
	plan, ok := f.plans[planType]
	if !ok || !plan.Active {
		return SubscriptionPlan{}, gorm.ErrRecordNotFound
	}
	return plan, nil
}

func (f *fakeStore) GetActiveByUserID(ctx context.Context, userID uuid.UUID) (UserSubscription, error) {
	if f.active != nil && f.active.UserID == userID {
		return *f.active, nil
	}
	return UserSubscription{}, gorm.ErrRecordNotFound
}

func (f *fakeStore) GetByCheckoutSessionID(ctx context.Context, sessionID string) (UserSubscription, error) {
	if sub, ok := f.bySession[sessionID]; ok {
		return sub, nil
	}
	return UserSubscription{}, gorm.ErrRecordNotFound
}

func (f *fakeStore) GetByStripeSubscriptionID(ctx context.Context, subscriptionID string) (UserSubscription, error) {
	if sub, ok := f.byStripeSub[subscriptionID]; ok {
		return sub, nil
	}
	return UserSubscription{}, gorm.ErrRecordNotFound
}

func (f *fakeStore) Create(ctx context.Context, sub UserSubscription) (UserSubscription, error) {
	if f.duplicateCreateSessionID != "" &&
		sub.StripeCheckoutSessionID != nil &&
		*sub.StripeCheckoutSessionID == f.duplicateCreateSessionID {
		return UserSubscription{}, ErrDuplicateCheckoutSession
	}
	if sub.ID == uuid.Nil {
		sub.ID = uuid.New()
	}
	f.created = append(f.created, sub)
	f.active = &sub
	if f.bySession == nil {
		f.bySession = map[string]UserSubscription{}
	}
	if sub.StripeCheckoutSessionID != nil {
		f.bySession[*sub.StripeCheckoutSessionID] = sub
	}
	return sub, nil
}

func (f *fakeStore) Update(ctx context.Context, sub UserSubscription) error {
	if f.byStripeSub != nil {
		if sub.StripeSubscriptionID != nil {
			f.byStripeSub[*sub.StripeSubscriptionID] = sub
		}
	}
	if f.active != nil && f.active.ID == sub.ID {
		copy := sub
		f.active = &copy
	}
	return nil
}

func defaultFakePlans() map[PlanType]SubscriptionPlan {
	return map[PlanType]SubscriptionPlan{
		PlanEntrances10: {
			PlanType:      PlanEntrances10,
			Name:          "10 Entrances",
			Perks:         []string{"10 office visits", "Use anytime"},
			StripePriceID: "price_1",
			Active:        true,
		},
		PlanMonthly: {
			PlanType:      PlanMonthly,
			Name:          "Monthly",
			Perks:         []string{"Unlimited entrances", "Renews monthly"},
			StripePriceID: "price_2",
			Active:        true,
		},
		PlanYearly: {
			PlanType:      PlanYearly,
			Name:          "Yearly",
			Perks:         []string{"Unlimited entrances", "Best value"},
			StripePriceID: "price_3",
			Active:        true,
		},
	}
}

type fakeUsers struct {
	customerID string
}

func (f *fakeUsers) UpsertFromPrincipal(ctx context.Context, p auth.Principal) (users.User, error) {
	return users.User{ID: p.UserID}, nil
}

func (f *fakeUsers) GetStripeCustomerID(ctx context.Context, userID uuid.UUID) (string, error) {
	return f.customerID, nil
}

func (f *fakeUsers) SetStripeCustomerID(ctx context.Context, userID uuid.UUID, customerID string) error {
	f.customerID = customerID
	return nil
}

type fakeStripe struct {
	checkoutURL      string
	event            stripe.Event
	constructError   error
	checkoutSessions map[string]stripe.CheckoutSession
}

func (f *fakeStripe) EnsureCustomer(ctx context.Context, userID uuid.UUID, email, existingCustomerID string) (string, error) {
	if existingCustomerID != "" {
		return existingCustomerID, nil
	}
	return "cus_test", nil
}

func (f *fakeStripe) CreateCheckoutSession(ctx context.Context, userID uuid.UUID, plan PlanType, priceID, customerID, successURL, cancelURL string) (string, string, error) {
	return "cs_test", f.checkoutURL, nil
}

func (f *fakeStripe) GetCheckoutSession(_ context.Context, sessionID string) (stripe.CheckoutSession, error) {
	if f.checkoutSessions != nil {
		if sess, ok := f.checkoutSessions[sessionID]; ok {
			return sess, nil
		}
	}
	return stripe.CheckoutSession{}, fmt.Errorf("checkout session %s not found", sessionID)
}

func (f *fakeStripe) ConstructEvent(payload []byte, signature string) (stripe.Event, error) {
	if f.constructError != nil {
		return stripe.Event{}, f.constructError
	}
	if f.event.Type != "" {
		return f.event, nil
	}
	return stripe.Event{}, fmt.Errorf("%w: invalid payload", ErrWebhookVerification)
}

func defaultTestConfig() Config {
	return Config{
		Enabled:       true,
		SecretKey:     "sk_test",
		WebhookSecret: "whsec_test",
		SuccessURL:    "coworkingapp://profile/subscription?checkout=success",
		CancelURL:     "coworkingapp://profile/subscription?checkout=cancel",
	}
}

func TestCreateCheckoutBlocksActiveSubscription(t *testing.T) {
	userID := uuid.New()
	store := &fakeStore{
		active: &UserSubscription{
			ID:       uuid.New(),
			UserID:   userID,
			PlanType: PlanMonthly,
			Status:   StatusActive,
		},
		plans: defaultFakePlans(),
	}
	svc := NewService(store, &fakeUsers{}, &fakeStripe{checkoutURL: "https://checkout.test"}, defaultTestConfig())

	_, err := svc.CreateCheckout(context.Background(), auth.Principal{UserID: userID, Email: "a@b.com"}, CheckoutRequest{PlanType: string(PlanMonthly)})
	if !errors.Is(err, ErrActiveSubscriptionExists) {
		t.Fatalf("expected ErrActiveSubscriptionExists, got %v", err)
	}
}

func TestCreateCheckoutReturnsURL(t *testing.T) {
	userID := uuid.New()
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{checkoutURL: "https://checkout.test/session"}, defaultTestConfig())

	resp, err := svc.CreateCheckout(context.Background(), auth.Principal{UserID: userID, Email: "a@b.com"}, CheckoutRequest{PlanType: string(PlanEntrances10)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.CheckoutURL != "https://checkout.test/session" {
		t.Fatalf("unexpected checkout url: %q", resp.CheckoutURL)
	}
}

func TestGetMineReturnsNilWhenNoSubscription(t *testing.T) {
	userID := uuid.New()
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})

	resp, err := svc.GetMine(context.Background(), auth.Principal{UserID: userID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp != nil {
		t.Fatalf("expected nil subscription, got %+v", resp)
	}
}

func TestGetMineReturnsActiveSubscription(t *testing.T) {
	userID := uuid.New()
	starts := time.Now().UTC()
	plans := defaultFakePlans()
	store := &fakeStore{
		active: &UserSubscription{
			ID:       uuid.New(),
			UserID:   userID,
			PlanType: PlanEntrances10,
			Status:   StatusActive,
			EntrancesRemaining: func() *int {
				n := 7
				return &n
			}(),
			StartsAt: starts,
		},
		plans: plans,
	}
	svc := NewService(store, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})

	resp, err := svc.GetMine(context.Background(), auth.Principal{UserID: userID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected subscription response")
	}
	if resp.PlanType != string(PlanEntrances10) {
		t.Fatalf("unexpected plan type: %q", resp.PlanType)
	}
	if resp.EntrancesRemaining == nil || *resp.EntrancesRemaining != 7 {
		t.Fatalf("unexpected entrances remaining: %+v", resp.EntrancesRemaining)
	}
	if len(resp.Perks) == 0 {
		t.Fatal("expected perks from plan catalog")
	}
	if resp.EntrancesTotal == nil || *resp.EntrancesTotal != EntrancesPackSize {
		t.Fatalf("unexpected entrances total: %+v", resp.EntrancesTotal)
	}
}

func TestCreateCheckoutRequiresStripeConfig(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})

	_, err := svc.CreateCheckout(context.Background(), auth.Principal{UserID: uuid.New()}, CheckoutRequest{PlanType: string(PlanMonthly)})
	if !errors.Is(err, ErrStripeNotConfigured) {
		t.Fatalf("expected ErrStripeNotConfigured, got %v", err)
	}
}

func TestCreateCheckoutRequiresPlanPriceID(t *testing.T) {
	plans := defaultFakePlans()
	plan := plans[PlanMonthly]
	plan.StripePriceID = ""
	plans[PlanMonthly] = plan

	svc := NewService(&fakeStore{plans: plans}, &fakeUsers{}, &fakeStripe{}, defaultTestConfig())

	_, err := svc.CreateCheckout(context.Background(), auth.Principal{UserID: uuid.New(), Email: "a@b.com"}, CheckoutRequest{PlanType: string(PlanMonthly)})
	if !errors.Is(err, ErrPlanNotConfigured) {
		t.Fatalf("expected ErrPlanNotConfigured, got %v", err)
	}
}

func TestListPlansFromStore(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})

	plans, err := svc.ListPlans(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(plans) != 3 {
		t.Fatalf("expected 3 plans, got %d", len(plans))
	}
}

func TestCreateCheckoutInvalidRedirectURL(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, defaultTestConfig())

	_, err := svc.CreateCheckout(context.Background(), auth.Principal{UserID: uuid.New(), Email: "a@b.com"}, CheckoutRequest{
		PlanType:   string(PlanMonthly),
		SuccessURL: "ftp://example.com",
	})
	if !errors.Is(err, ErrInvalidRedirectURL) {
		t.Fatalf("expected ErrInvalidRedirectURL, got %v", err)
	}
}
