package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func jwksJSONRSA(pub *rsa.PublicKey, kid string) string {
	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
	e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())
	return fmt.Sprintf(
		`{"keys":[{"kty":"RSA","kid":%q,"use":"sig","alg":"RS256","n":%q,"e":%q}]}`,
		kid, n, e,
	)
}

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

func TestIssuersMatch_trailingSlash(t *testing.T) {
	base := "https://abc123.supabase.co/auth/v1"
	if !issuersMatch(base, base+"/") {
		t.Fatal("expected match")
	}
	if issuersMatch(base, "https://other.supabase.co/auth/v1") {
		t.Fatal("expected mismatch")
	}
}

func TestVerifier_Verify_RS256_JWKS(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const kid = "k1"
	jwksBody := jwksJSONRSA(&priv.PublicKey, kid)

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/v1/.well-known/jwks.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwksBody))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	issuer := srv.URL + "/auth/v1"
	jwksURL := issuer + "/.well-known/jwks.json"

	k, err := keyfunc.NewDefaultCtx(context.Background(), []string{jwksURL})
	if err != nil {
		t.Fatal(err)
	}

	v, err := NewVerifier("", WithIssuer(issuer), WithJWKS(k))
	if err != nil {
		t.Fatal(err)
	}

	uid := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, supabaseClaims{
		Email:         "rs@example.com",
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uid.String(),
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	token.Header["kid"] = kid
	raw, err := token.SignedString(priv)
	if err != nil {
		t.Fatal(err)
	}

	p, err := v.Verify(raw)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if p.UserID != uid || p.Email != "rs@example.com" || !p.EmailVerified {
		t.Fatalf("principal: %+v", p)
	}
}

func TestVerifier_rejectsUnsupportedAlg(t *testing.T) {
	secret := "test-secret-at-least-32-bytes-long!!"
	iss, _ := IssuerFromSupabaseURL("https://abc123.supabase.co")
	v, _ := NewVerifier(secret, WithIssuer(iss))

	uid := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, supabaseClaims{
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
	if _, err := v.Verify(raw); err == nil {
		t.Fatal("expected error for unsupported alg")
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
