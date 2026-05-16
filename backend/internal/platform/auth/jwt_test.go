package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestVerifier_Verify_roundTrip(t *testing.T) {
	secret := "test-secret-at-least-32-bytes-long!!"
	iss, err := IssuerFromSupabaseURL("https://abc123.supabase.co")
	if err != nil {
		t.Fatal(err)
	}
	v, err := NewVerifier(secret, WithIssuer(iss))
	if err != nil {
		t.Fatal(err)
	}

	uid := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, supabaseClaims{
		Email:         "a@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uid.String(),
			Issuer:    iss,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	raw, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	p, err := v.Verify(raw)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if p.UserID != uid {
		t.Fatalf("user id: got %v want %v", p.UserID, uid)
	}
	if p.Email != "a@example.com" || !p.EmailVerified {
		t.Fatalf("claims: %+v", p)
	}
}

func TestVerifier_Verify_wrongSecret(t *testing.T) {
	secret := "test-secret-at-least-32-bytes-long!!"
	iss, _ := IssuerFromSupabaseURL("https://abc123.supabase.co")
	v, _ := NewVerifier(secret, WithIssuer(iss))

	uid := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, supabaseClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uid.String(),
			Issuer:    iss,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	raw, err := token.SignedString([]byte("other-secret-at-least-32-bytes-long"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := v.Verify(raw); err == nil {
		t.Fatal("expected error")
	}
}

func TestBearerToken(t *testing.T) {
	got, err := BearerToken("Bearer abc.def.ghi")
	if err != nil || got != "abc.def.ghi" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := BearerToken("Basic x"); err == nil {
		t.Fatal("expected error")
	}
}

func TestMiddleware_allowsValidToken(t *testing.T) {
	secret := "test-secret-at-least-32-bytes-long!!"
	iss, _ := IssuerFromSupabaseURL("https://abc123.supabase.co")
	v, err := NewVerifier(secret, WithIssuer(iss))
	if err != nil {
		t.Fatal(err)
	}

	uid := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, supabaseClaims{
		Email: "b@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uid.String(),
			Issuer:    iss,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	raw, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	var sawPrincipal bool
	h := Middleware(v, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := PrincipalFromContext(r.Context())
		if !ok || p.UserID != uid {
			t.Errorf("principal: ok=%v p=%+v", ok, p)
			return
		}
		sawPrincipal = true
		w.WriteHeader(http.StatusTeapot)
	}))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTeapot {
		t.Fatalf("status %d", rec.Code)
	}
	if !sawPrincipal {
		t.Fatal("handler not called with principal")
	}
}
