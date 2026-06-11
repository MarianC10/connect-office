package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
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
	jwks     keyfunc.Keyfunc
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

func WithJWKS(k keyfunc.Keyfunc) VerifierOption {
	return func(v *Verifier) {
		v.jwks = k
	}
}

func NewVerifier(jwtSecret string, opts ...VerifierOption) (*Verifier, error) {
	secret := strings.TrimSpace(jwtSecret)
	v := &Verifier{
		secret:   []byte(secret),
		audience: "authenticated",
	}
	for _, o := range opts {
		o(v)
	}
	if len(v.secret) == 0 && v.jwks == nil {
		return nil, errors.New("jwt verifier needs a secret (HS256) or JWKS (RS256/ES256); leave SUPABASE_JWT_SECRET empty only when the issuer URL is set so JWKS loads")
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

func JWKSURLFromIssuer(issuer string) (string, error) {
	iss := strings.TrimSpace(issuer)
	if iss == "" {
		return "", errors.New("issuer is empty")
	}
	return strings.TrimRight(iss, "/") + "/.well-known/jwks.json", nil
}

func issuersMatch(expected, fromToken string) bool {
	a := strings.TrimRight(strings.TrimSpace(expected), "/")
	b := strings.TrimRight(strings.TrimSpace(fromToken), "/")
	return a != "" && a == b
}

func (v *Verifier) Verify(raw string) (Principal, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return Principal{}, ErrMissingToken
	}

	headerToken, _, err := jwt.NewParser().ParseUnverified(raw, jwt.MapClaims{})
	if err != nil {
		return Principal{}, ErrInvalidToken
	}
	if headerToken.Method == nil {
		return Principal{}, ErrInvalidToken
	}

	alg := headerToken.Method.Alg()
	var keyFunc jwt.Keyfunc
	switch alg {
	case jwt.SigningMethodHS256.Alg():
		if len(v.secret) == 0 {
			return Principal{}, ErrInvalidToken
		}
		keyFunc = func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method %q", token.Header["alg"])
			}
			return v.secret, nil
		}
	case jwt.SigningMethodRS256.Alg(), jwt.SigningMethodES256.Alg():
		if v.jwks == nil {
			return Principal{}, ErrInvalidToken
		}
		keyFunc = v.jwks.Keyfunc
	default:
		return Principal{}, ErrInvalidToken
	}

	var claims supabaseClaims
	token, err := jwt.ParseWithClaims(raw, &claims, keyFunc)
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
		if err != nil || !issuersMatch(v.issuer, iss) {
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
