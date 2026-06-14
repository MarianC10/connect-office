package subscriptions

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

func TestMeHandlerNoSubscription404(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})
	handler := NewMeHandler(svc)

	userID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/subscriptions/me", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: userID}))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d, want 404", rec.Code)
	}
}

func TestMeHandlerReturnsSubscription(t *testing.T) {
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
	svc := NewService(store, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})
	handler := NewMeHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/subscriptions/me", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: userID}))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
}

func TestPlansHandlerAlways200WhenDisabled(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: false})
	handler := NewPlansHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/subscriptions/plans", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
}

func TestPlansHandlerReturnsPlansWhenEnabled(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: true})
	handler := NewPlansHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/subscriptions/plans", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	if rec.Body.Len() == 0 {
		t.Fatal("expected non-empty plans body")
	}
}

func TestMeHandlerDisabled404(t *testing.T) {
	svc := NewService(&fakeStore{}, &fakeUsers{}, &fakeStripe{}, Config{Enabled: false})
	handler := NewMeHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/subscriptions/me", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: uuid.New()}))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d, want 404", rec.Code)
	}
}

func TestCreateCheckoutInvalidRedirectURLHandler400(t *testing.T) {
	svc := NewService(&fakeStore{plans: defaultFakePlans()}, &fakeUsers{}, &fakeStripe{}, defaultTestConfig())
	handler := NewCheckoutHandler(svc)

	body := `{"plan_type":"monthly","success_url":"ftp://bad.example"}`
	req := httptest.NewRequest(http.MethodPost, "/subscriptions/checkout", io.NopCloser(strings.NewReader(body)))
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: uuid.New(), Email: "a@b.com"}))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
}
