package chat

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

const maxMessageRunes = 2000

type Broadcaster interface {
	BroadcastMessage(conversationID uuid.UUID, msg MessageResponse, recipientIDs ...uuid.UUID)
}

type Service struct {
	store       Store
	broadcaster Broadcaster
}

func NewService(store Store, broadcaster Broadcaster) *Service {
	return &Service{store: store, broadcaster: broadcaster}
}

func (s *Service) CreateConversationForPair(ctx context.Context, userA, userB uuid.UUID) (Conversation, error) {
	return s.store.CreateConversationForPair(ctx, userA, userB)
}

func (s *Service) ListConversations(ctx context.Context, p auth.Principal) ([]ConversationResponse, error) {
	items, err := s.store.ListConversations(ctx, p.UserID)
	if err != nil {
		return nil, err
	}
	out := make([]ConversationResponse, 0, len(items))
	for _, item := range items {
		other, ok := OtherParticipant(item.Conversation, p.UserID)
		isFriend := false
		if ok {
			isFriend, err = s.store.AreFriends(ctx, p.UserID, other)
			if err != nil {
				return nil, err
			}
		}
		out = append(out, conversationListItemToResponse(item, isFriend))
	}
	return out, nil
}

func (s *Service) GetConversationWithFriend(ctx context.Context, p auth.Principal, friendIDStr string) (ConversationResponse, error) {
	friendID, err := uuid.Parse(friendIDStr)
	if err != nil {
		return ConversationResponse{}, ErrFriendNotFound
	}

	conv, err := s.store.GetConversationByPair(ctx, p.UserID, friendID)
	if errors.Is(err, ErrConversationNotFound) {
		friends, friendErr := s.store.AreFriends(ctx, p.UserID, friendID)
		if friendErr != nil {
			return ConversationResponse{}, friendErr
		}
		if !friends {
			return ConversationResponse{}, ErrNotFriends
		}
		conv, err = s.store.CreateConversationForPair(ctx, p.UserID, friendID)
	}
	if err != nil {
		return ConversationResponse{}, err
	}

	peer, err := s.store.GetPeerProfile(ctx, friendID)
	if err != nil {
		return ConversationResponse{}, err
	}

	item := ConversationListItem{
		Conversation: conv,
		Friend:       peer,
	}
	last, err := s.store.ListMessages(ctx, conv.ID, nil, 1)
	if err != nil {
		return ConversationResponse{}, err
	}
	if len(last) > 0 {
		item.LastMessage = &last[0]
	}

	isFriend, err := s.store.AreFriends(ctx, p.UserID, friendID)
	if err != nil {
		return ConversationResponse{}, err
	}
	return conversationListItemToResponse(item, isFriend), nil
}

func (s *Service) ListMessages(ctx context.Context, p auth.Principal, conversationIDStr string, beforeStr string, limit int) ([]MessageResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return nil, ErrConversationNotFound
	}
	if err := s.ensureParticipant(ctx, p.UserID, convID); err != nil {
		return nil, err
	}

	var before *uuid.UUID
	if strings.TrimSpace(beforeStr) != "" {
		id, parseErr := uuid.Parse(beforeStr)
		if parseErr != nil {
			return nil, ErrInvalidMessage
		}
		before = &id
	}

	messages, err := s.store.ListMessages(ctx, convID, before, limit)
	if err != nil {
		return nil, err
	}
	out := make([]MessageResponse, 0, len(messages))
	for _, msg := range messages {
		out = append(out, messageToResponse(msg))
	}
	return out, nil
}

func (s *Service) SendMessage(ctx context.Context, p auth.Principal, conversationIDStr string, body string) (MessageResponse, error) {
	convID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		return MessageResponse{}, ErrConversationNotFound
	}
	normalized, err := normalizeMessageBody(body)
	if err != nil {
		return MessageResponse{}, err
	}

	conv, err := s.store.GetConversationByID(ctx, convID)
	if err != nil {
		return MessageResponse{}, err
	}
	if _, ok := OtherParticipant(conv, p.UserID); !ok {
		return MessageResponse{}, ErrNotParticipant
	}
	if err := s.ensureFriendsForConversation(ctx, p.UserID, conv); err != nil {
		return MessageResponse{}, err
	}

	msg, err := s.store.InsertMessage(ctx, convID, p.UserID, normalized)
	if err != nil {
		return MessageResponse{}, err
	}
	resp := messageToResponse(msg)
	if s.broadcaster != nil {
		other, _ := OtherParticipant(conv, p.UserID)
		s.broadcaster.BroadcastMessage(convID, resp, p.UserID, other)
	}
	return resp, nil
}

func (s *Service) SendMessageFromWS(ctx context.Context, userID uuid.UUID, conversationID uuid.UUID, body string) (MessageResponse, error) {
	return s.SendMessage(ctx, auth.Principal{UserID: userID}, conversationID.String(), body)
}

func (s *Service) ensureParticipant(ctx context.Context, userID, convID uuid.UUID) error {
	conv, err := s.store.GetConversationByID(ctx, convID)
	if err != nil {
		return err
	}
	if _, ok := OtherParticipant(conv, userID); !ok {
		return ErrNotParticipant
	}
	return nil
}

func (s *Service) ensureFriendsForConversation(ctx context.Context, userID uuid.UUID, conv Conversation) error {
	other, ok := OtherParticipant(conv, userID)
	if !ok {
		return ErrNotParticipant
	}
	friends, err := s.store.AreFriends(ctx, userID, other)
	if err != nil {
		return err
	}
	if !friends {
		return ErrNotFriends
	}
	return nil
}

func normalizeMessageBody(body string) (string, error) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return "", ErrInvalidMessage
	}
	if utf8.RuneCountInString(trimmed) > maxMessageRunes {
		return "", ErrInvalidMessage
	}
	return trimmed, nil
}

func conversationListItemToResponse(item ConversationListItem, isFriend bool) ConversationResponse {
	resp := ConversationResponse{
		ID: item.Conversation.ID.String(),
		IsFriend: isFriend,
		Friend: ConversationFriend{
			ID:          item.Friend.ID.String(),
			DisplayName: item.Friend.DisplayName,
			AvatarURL:   item.Friend.AvatarURL,
		},
	}
	if item.LastMessage != nil {
		resp.LastMessage = &LastMessagePreview{
			ID:        item.LastMessage.ID.String(),
			Body:      item.LastMessage.Body,
			CreatedAt: item.LastMessage.CreatedAt.UTC().Format(time.RFC3339),
		}
	}
	return resp
}

func messageToResponse(msg Message) MessageResponse {
	return MessageResponse{
		ID:        msg.ID.String(),
		SenderID:  msg.SenderID.String(),
		Body:      msg.Body,
		CreatedAt: msg.CreatedAt.UTC().Format(time.RFC3339),
	}
}
