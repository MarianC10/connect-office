package subscriptions

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func NewPlansHandler(svc *Service) http.HandlerFunc {
	return withMethod(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		plans, err := svc.ListPlans(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if plans == nil {
			plans = []PlanResponse{}
		}
		writeJSON(w, http.StatusOK, plans)
	})
}

func NewMeHandler(svc *Service) http.HandlerFunc {
	return withSubscriptionsEnabled(svc, http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		sub, err := svc.GetMine(r.Context(), p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if sub == nil {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, sub)
	})
}

func NewCheckoutHandler(svc *Service) http.HandlerFunc {
	return withSubscriptionsEnabled(svc, http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var req CheckoutRequest
		if err := json.Unmarshal(body, &req); err != nil {
			http.Error(w, "invalid json body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.PlanType) == "" {
			http.Error(w, "plan_type is required", http.StatusBadRequest)
			return
		}

		resp, err := svc.CreateCheckout(r.Context(), p, req)
		if err != nil {
			writeSubscriptionError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func NewWebhookHandler(svc *Service) http.HandlerFunc {
	return withSubscriptionsEnabled(svc, http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		payload, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := svc.HandleWebhook(r.Context(), payload, r.Header.Get("Stripe-Signature")); err != nil {
			writeSubscriptionError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func writeSubscriptionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidPlanType),
		errors.Is(err, ErrInvalidRedirectURL),
		errors.Is(err, ErrWebhookVerification):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrActiveSubscriptionExists):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, ErrStripeNotConfigured),
		errors.Is(err, ErrPlanNotConfigured):
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}
