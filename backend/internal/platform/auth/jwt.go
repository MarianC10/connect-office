package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrMissingToken   = errors.New("missing bearer token")
	ErrInvalidToken   = errors.New("invalid token")
	ErrInvalidSubject = errors.New("invalid subject")
)

type Principal struct {
	UserID        uuid.UUID
	Email         string
	EmailVerified bool
}

type Verifier struct {
	secret   []byte
	issuer   string
	audience string
}

type VerifierOption func(*Verifier)

func WithIssuer(iss string) VerifierOption {
	return func(v *Verifier) {
		v.issuer = strings.TrimSpace(iss)
	}
}

func WithAudience(aud string) VerifierOption {
	return func(v *Verifier) {
		v.audience = strings.TrimSpace(aud)
	}
}

func NewVerifier(jwtSecret string, opts ...VerifierOption) (*Verifier, error) {
	secret := strings.TrimSpace(jwtSecret)
	if secret == "" {
		return nil, errors.New("jwt secret is required")
	}
	v := &Verifier{
		secret:   []byte(secret),
		audience: "authenticated",
	}
	for _, o := range opts {
		o(v)
	}
	return v, nil
}

func IssuerFromSupabaseURL(projectURL string) (string, error) {
	u := strings.TrimSpace(projectURL)
	if u == "" {
		return "", errors.New("supabase url is empty")
	}
	u = strings.TrimRight(u, "/")
	return u + "/auth/v1", nil
}

type supabaseClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	jwt.RegisteredClaims
}

func (v *Verifier) Verify(raw string) (Principal, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return Principal{}, ErrMissingToken
	}

	var claims supabaseClaims
	token, err := jwt.ParseWithClaims(raw, &claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %q", token.Header["alg"])
		}
		return v.secret, nil
	})
	if err != nil || !token.Valid {
		return Principal{}, ErrInvalidToken
	}

	exp, err := claims.GetExpirationTime()
	if err != nil || exp == nil || exp.Before(time.Now()) {
		return Principal{}, ErrInvalidToken
	}

	if v.audience != "" {
		aud, err := claims.GetAudience()
		if err != nil {
			return Principal{}, ErrInvalidToken
		}
		ok := false
		for _, a := range aud {
			if a == v.audience {
				ok = true
				break
			}
		}
		if !ok {
			return Principal{}, ErrInvalidToken
		}
	}

	if v.issuer != "" {
		iss, err := claims.GetIssuer()
		if err != nil || iss != v.issuer {
			return Principal{}, ErrInvalidToken
		}
	}

	sub := strings.TrimSpace(claims.Subject)
	if sub == "" {
		return Principal{}, ErrInvalidSubject
	}
	uid, err := uuid.Parse(sub)
	if err != nil {
		return Principal{}, ErrInvalidSubject
	}

	return Principal{
		UserID:        uid,
		Email:         strings.TrimSpace(claims.Email),
		EmailVerified: claims.EmailVerified,
	}, nil
}

func BearerToken(h string) (string, error) {
	h = strings.TrimSpace(h)
	if h == "" {
		return "", ErrMissingToken
	}
	const prefix = "Bearer "
	if len(h) < len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", ErrMissingToken
	}
	return strings.TrimSpace(h[len(prefix):]), nil
}
