package friends

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
)

type UserReader interface {
	GetByID(ctx context.Context, userID uuid.UUID) (users.User, error)
	GetByEmail(ctx context.Context, email string) (users.User, error)
	UpsertFromPrincipal(ctx context.Context, p auth.Principal) (users.User, error)
}

type Service struct {
	store    Store
	users    UserReader
	cfg      users.Config
	notifier RealtimeNotifier
}

func NewService(store Store, users UserReader, cfg users.Config, notifier RealtimeNotifier) *Service {
	return &Service{store: store, users: users, cfg: cfg, notifier: notifier}
}

func (s *Service) CreateRequest(ctx context.Context, p auth.Principal, body CreateRequestBody) (FriendRequestResponse, error) {
	if _, err := s.users.UpsertFromPrincipal(ctx, p); err != nil {
		return FriendRequestResponse{}, err
	}

	hasUserID := strings.TrimSpace(body.UserID) != ""
	hasEmail := strings.TrimSpace(body.Email) != ""
	if hasUserID == hasEmail {
		return FriendRequestResponse{}, ErrInvalidRequest
	}

	var target users.User
	var err error
	if hasUserID {
		targetID, parseErr := uuid.Parse(body.UserID)
		if parseErr != nil {
			return FriendRequestResponse{}, users.ErrUserNotFound
		}
		target, err = s.users.GetByID(ctx, targetID)
	} else {
		target, err = s.users.GetByEmail(ctx, body.Email)
	}
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			return FriendRequestResponse{}, ErrUserNotFound
		}
		return FriendRequestResponse{}, err
	}

	if target.ID == p.UserID {
		return FriendRequestResponse{}, ErrCannotFriendSelf
	}

	friends, err := s.store.AreFriends(ctx, p.UserID, target.ID)
	if err != nil {
		return FriendRequestResponse{}, err
	}
	if friends {
		return FriendRequestResponse{}, ErrAlreadyFriends
	}

	pending, err := s.store.HasPendingBetween(ctx, p.UserID, target.ID)
	if err != nil {
		return FriendRequestResponse{}, err
	}
	if pending {
		return FriendRequestResponse{}, ErrPendingRequestExists
	}

	req, err := s.store.CreateRequest(ctx, p.UserID, target.ID)
	if err != nil {
		return FriendRequestResponse{}, err
	}

	fromUser, err := s.users.GetByID(ctx, p.UserID)
	if err != nil {
		return FriendRequestResponse{}, err
	}
	item := requestToInboxItem(req, fromUser, s.cfg)
	if s.notifier != nil {
		s.notifier.NotifyFriendRequestNew(target.ID, item)
	}
	return item, nil
}

func (s *Service) ListInbox(ctx context.Context, p auth.Principal) ([]FriendRequestResponse, error) {
	items, err := s.store.ListPendingInbox(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	out := make([]FriendRequestResponse, 0, len(items))
	for _, req := range items {
		fromUser, err := s.users.GetByID(ctx, req.FromUserID)
		if err != nil {
			return nil, err
		}
		out = append(out, requestToInboxItem(req, fromUser, s.cfg))
	}
	return out, nil
}

func (s *Service) AcceptRequest(ctx context.Context, p auth.Principal, requestID string) error {
	id, err := uuid.Parse(requestID)
	if err != nil {
		return ErrRequestNotFound
	}
	req, err := s.store.AcceptRequest(ctx, id, p.UserID)
	if err != nil {
		return err
	}
	if s.notifier != nil {
		accepter, err := s.users.GetByID(ctx, p.UserID)
		if err != nil {
			return err
		}
		s.notifier.NotifyFriendRequestAccepted(req.FromUserID, FriendResponse{
			ID:          accepter.ID.String(),
			DisplayName: accepter.DisplayName,
			IsPublic:    accepter.IsPublic,
			AvatarURL:   users.ResolveAvatarURL(accepter.AvatarURL, s.cfg),
		})
	}
	return nil
}

func (s *Service) DeclineRequest(ctx context.Context, p auth.Principal, requestID string) error {
	id, err := uuid.Parse(requestID)
	if err != nil {
		return ErrRequestNotFound
	}
	return s.store.DeclineRequest(ctx, id, p.UserID)
}

func (s *Service) ListFriends(ctx context.Context, p auth.Principal) ([]FriendResponse, error) {
	items, err := s.store.ListFriends(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	out := make([]FriendResponse, 0, len(items))
	for _, item := range items {
		out = append(out, FriendResponse{
			ID:          item.ID.String(),
			DisplayName: item.DisplayName,
			IsPublic:    item.IsPublic,
			AvatarURL:   item.AvatarURL,
		})
	}
	return out, nil
}

func requestToInboxItem(req FriendRequest, fromUser users.User, cfg users.Config) FriendRequestResponse {
	avatar := users.ResolveAvatarURL(fromUser.AvatarURL, cfg)
	return FriendRequestResponse{
		ID:          req.ID.String(),
		FromUserID:  req.FromUserID.String(),
		DisplayName: fromUser.DisplayName,
		AvatarURL:   avatar,
		CreatedAt:   req.CreatedAt.UTC().Format(time.RFC3339),
	}
}
