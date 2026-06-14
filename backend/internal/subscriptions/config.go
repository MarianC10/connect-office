package subscriptions

import (
	"os"
	"strings"
)

type Config struct {
	Enabled       bool
	SecretKey     string
	WebhookSecret string
	SuccessURL    string
	CancelURL     string
}

func LoadConfigFromEnv() Config {
	return Config{
		Enabled:       strings.EqualFold(strings.TrimSpace(os.Getenv("SUBSCRIPTIONS_ENABLED")), "true"),
		SecretKey:       strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		WebhookSecret: strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		SuccessURL:    defaultCheckoutURL(os.Getenv("SUBSCRIPTIONS_CHECKOUT_SUCCESS_URL"), "coworkingapp://profile/subscription?checkout=success"),
		CancelURL:     defaultCheckoutURL(os.Getenv("SUBSCRIPTIONS_CHECKOUT_CANCEL_URL"), "coworkingapp://profile/subscription?checkout=cancel"),
	}
}

func (c Config) StripeConfigured() bool {
	return c.SecretKey != ""
}

func (c Config) WebhookConfigured() bool {
	return c.SecretKey != "" && c.WebhookSecret != ""
}

func defaultCheckoutURL(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
