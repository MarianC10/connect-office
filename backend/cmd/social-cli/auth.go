package main

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/devtest"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

type authConfig struct {
	secret   string
	issuer   string
	audience string
	userID   uuid.UUID
	email    string
}

func loadAuthConfig(userIDOverride string) (authConfig, error) {
	if err := godotenv.Load(".env"); err != nil {
		_ = godotenv.Load("backend/.env")
	}

	cfg := authConfig{
		secret:   strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET")),
		audience: strings.TrimSpace(os.Getenv("SUPABASE_JWT_AUDIENCE")),
		userID:   devtest.TestUserID,
		email:    devtest.TestUserEmail,
	}
	if cfg.audience == "" {
		cfg.audience = "authenticated"
	}

	if iss := strings.TrimSpace(os.Getenv("SUPABASE_JWT_ISSUER")); iss != "" {
		cfg.issuer = iss
	} else if base := strings.TrimSpace(os.Getenv("SUPABASE_URL")); base != "" {
		iss, err := auth.IssuerFromSupabaseURL(base)
		if err != nil {
			return authConfig{}, err
		}
		cfg.issuer = iss
	}

	if userIDOverride != "" {
		id, err := uuid.Parse(userIDOverride)
		if err != nil {
			return authConfig{}, fmt.Errorf("invalid --user-id: %w", err)
		}
		cfg.userID = id
	}

	if cfg.secret == "" {
		return authConfig{}, fmt.Errorf("SUPABASE_JWT_SECRET is required to mint tokens for the seed bot")
	}
	return cfg, nil
}

func resolveToken(tokenOverride, userIDOverride string) (string, error) {
	if t := strings.TrimSpace(tokenOverride); t != "" {
		return t, nil
	}
	if t := strings.TrimSpace(os.Getenv("SOCIAL_CLI_TOKEN")); t != "" {
		return t, nil
	}

	cfg, err := loadAuthConfig(userIDOverride)
	if err != nil {
		return "", err
	}
	return mintToken(cfg)
}

type mintClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	jwt.RegisteredClaims
}

func mintToken(cfg authConfig) (string, error) {
	now := time.Now().UTC()
	claims := mintClaims{
		Email:         cfg.email,
		EmailVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   cfg.userID.String(),
			Audience:  jwt.ClaimStrings{cfg.audience},
			Issuer:    cfg.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.secret))
}

func wsURL(apiBase, token string) string {
	base := strings.TrimRight(apiBase, "/")
	if strings.HasPrefix(base, "https://") {
		base = "wss://" + strings.TrimPrefix(base, "https://")
	} else if strings.HasPrefix(base, "http://") {
		base = "ws://" + strings.TrimPrefix(base, "http://")
	} else {
		base = "ws://" + base
	}
	return base + "/chat/ws?token=" + url.QueryEscape(token)
}
