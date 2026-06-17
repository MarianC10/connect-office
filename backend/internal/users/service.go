package users

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

type Service struct {
	store   Store
	cfg     Config
	limiter *emailLookupLimiter
}

func NewService(store Store, cfg Config) *Service {
	return &Service{
		store:   store,
		cfg:     cfg,
		limiter: newEmailLookupLimiter(10, time.Minute),
	}
}

func (s *Service) Me(ctx context.Context, p auth.Principal) (MeResponse, error) {
	u, err := s.store.UpsertFromPrincipal(ctx, p)
	if err != nil {
		return MeResponse{}, err
	}
	return userToMe(u, s.cfg), nil
}

func (s *Service) UpdateMe(ctx context.Context, p auth.Principal, req UpdateMeRequest) (MeResponse, error) {
	if _, err := s.store.UpsertFromPrincipal(ctx, p); err != nil {
		return MeResponse{}, err
	}
	u, err := s.store.UpdateProfile(ctx, p.UserID, req.DisplayName, req.IsPublic)
	if err != nil {
		return MeResponse{}, err
	}
	return userToMe(u, s.cfg), nil
}

func (s *Service) UploadAvatar(ctx context.Context, p auth.Principal, r io.Reader, contentType string, peek []byte) (MeResponse, error) {
	if _, err := s.store.UpsertFromPrincipal(ctx, p); err != nil {
		return MeResponse{}, err
	}

	ct := detectAvatarContentType(contentType, peek)
	if ct == "" {
		return MeResponse{}, fmt.Errorf("unsupported image type")
	}

	reader := io.MultiReader(bytes.NewReader(peek), r)
	url, err := saveAvatarFile(s.cfg, p.UserID, reader, ct)
	if err != nil {
		return MeResponse{}, err
	}

	u, err := s.store.SetAvatarURL(ctx, p.UserID, url)
	if err != nil {
		return MeResponse{}, err
	}
	return userToMe(u, s.cfg), nil
}

func (s *Service) Search(ctx context.Context, query string) ([]PublicProfileResponse, error) {
	query = strings.TrimSpace(query)
	if len(query) < 2 {
		return nil, ErrSearchQueryTooShort
	}
	items, err := s.store.SearchPublicByDisplayName(ctx, query, 20)
	if err != nil {
		return nil, err
	}
	out := make([]PublicProfileResponse, 0, len(items))
	for _, u := range items {
		out = append(out, userToPublicProfile(u, s.cfg))
	}
	return out, nil
}

func (s *Service) LookupByEmail(ctx context.Context, p auth.Principal, email string) (PublicProfileResponse, error) {
	if !s.limiter.allow(p.UserID) {
		return PublicProfileResponse{}, ErrRateLimited
	}
	u, err := s.store.GetByEmail(ctx, email)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	return userToPublicProfile(u, s.cfg), nil
}

func (s *Service) GetPublicProfile(ctx context.Context, userID uuid.UUID) (PublicProfileResponse, error) {
	u, err := s.store.GetByID(ctx, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	return userToPublicProfile(u, s.cfg), nil
}

func userToMe(u User, cfg Config) MeResponse {
	out := MeResponse{
		ID:            u.ID.String(),
		EmailVerified: u.EmailVerified,
		DisplayName:   u.DisplayName,
		IsPublic:      u.IsPublic,
		AvatarURL:     resolveAvatarURL(u.AvatarURL, cfg),
	}
	if u.Email != nil {
		out.Email = *u.Email
	}
	return out
}

func userToPublicProfile(u User, cfg Config) PublicProfileResponse {
	return PublicProfileResponse{
		ID:          u.ID.String(),
		DisplayName: u.DisplayName,
		IsPublic:    u.IsPublic,
		AvatarURL:   resolveAvatarURL(u.AvatarURL, cfg),
	}
}

func resolveAvatarURL(avatarURL *string, cfg Config) string {
	if avatarURL != nil && IsCustomAvatarURL(*avatarURL) {
		return strings.TrimSpace(*avatarURL)
	}
	return cfg.DefaultAvatarURL()
}

// IsCustomAvatarURL reports whether the stored value is a user upload (not the default placeholder).
func IsCustomAvatarURL(url string) bool {
	trimmed := strings.TrimSpace(url)
	return trimmed != "" && !strings.HasSuffix(trimmed, "/avatars/default.png")
}

// ResolveAvatarURL returns the API avatar URL for a user row.
func ResolveAvatarURL(avatarURL *string, cfg Config) string {
	return resolveAvatarURL(avatarURL, cfg)
}
