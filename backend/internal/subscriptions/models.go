package subscriptions

import "time"

type PlanResponse struct {
	PlanType string   `json:"plan_type"`
	Name     string   `json:"name"`
	Perks    []string `json:"perks"`
}

type MySubscriptionResponse struct {
	PlanType           string     `json:"plan_type"`
	Status             string     `json:"status"`
	EntrancesRemaining *int       `json:"entrances_remaining"`
	EntrancesTotal     *int       `json:"entrances_total,omitempty"`
	StartsAt           time.Time  `json:"starts_at"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	Perks              []string   `json:"perks"`
}

type CheckoutRequest struct {
	PlanType   string `json:"plan_type"`
	SuccessURL string `json:"success_url,omitempty"`
	CancelURL  string `json:"cancel_url,omitempty"`
}

type CheckoutResponse struct {
	CheckoutURL string `json:"checkout_url"`
}
