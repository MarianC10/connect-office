package subscriptions

import (
	"fmt"
	"net/url"
	"strings"
)

func resolveCheckoutRedirectURL(value, fallback string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		value = fallback
	}
	if err := validateCheckoutRedirectURL(value); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidRedirectURL, err)
	}
	return value, nil
}

func validateCheckoutRedirectURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("parse redirect url: %w", err)
	}
	if parsed.Scheme == "" {
		return fmt.Errorf("redirect url must include a scheme")
	}
	switch parsed.Scheme {
	case "coworkingapp", "exp", "http", "https":
		return nil
	default:
		return fmt.Errorf("unsupported redirect scheme %q", parsed.Scheme)
	}
}
