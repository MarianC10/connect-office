package users

import (
	"context"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Me(ctx context.Context, p auth.Principal) (MeResponse, error) {
	u, err := s.store.UpsertFromPrincipal(ctx, p)
	if err != nil {
		return MeResponse{}, err
	}
	return userToMe(u), nil
}

func userToMe(u User) MeResponse {
	out := MeResponse{
		ID:            u.ID.String(),
		EmailVerified: u.EmailVerified,
	}
	if u.Email != nil {
		out.Email = *u.Email
	}
	return out
}
