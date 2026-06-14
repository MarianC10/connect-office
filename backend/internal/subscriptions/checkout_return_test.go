package subscriptions

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheckoutReturnHandler(t *testing.T) {
	handler := NewCheckoutReturnHandler(Config{Enabled: true})

	t.Run("success html", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/subscriptions/checkout-return?checkout=success&app_redirect=coworkingapp%3A%2F%2Fprofile%2Fsubscription%3Fcheckout%3Dsuccess", nil)
		rec := httptest.NewRecorder()
		handler(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Payment complete") {
			t.Fatalf("unexpected body: %s", body)
		}
		if !strings.Contains(body, "coworkingapp://profile/subscription") {
			t.Fatalf("missing app redirect in body: %s", body)
		}
	})

	t.Run("invalid checkout", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/subscriptions/checkout-return?checkout=bad", nil)
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status %d", rec.Code)
		}
	})
}
