package subscriptions

import "testing"

func TestValidateCheckoutRedirectURL(t *testing.T) {
	for _, tc := range []struct {
		url string
		ok  bool
	}{
		{"coworkingapp://profile/subscription?checkout=success", true},
		{"exp://192.168.0.1:8081/--/profile/subscription?checkout=success", true},
		{"http://localhost:8081/profile/subscription?checkout=success", true},
		{"ftp://example.com", false},
		{"not-a-url", false},
	} {
		err := validateCheckoutRedirectURL(tc.url)
		if tc.ok && err != nil {
			t.Fatalf("expected ok for %q: %v", tc.url, err)
		}
		if !tc.ok && err == nil {
			t.Fatalf("expected error for %q", tc.url)
		}
	}
}
