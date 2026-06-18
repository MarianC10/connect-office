package chat

import "errors"

var (
	ErrConversationNotFound = errors.New("conversation not found")
	ErrNotParticipant       = errors.New("not a conversation participant")
	ErrNotFriends           = errors.New("users are not friends")
	ErrInvalidMessage       = errors.New("invalid message body")
	ErrFriendNotFound       = errors.New("friend not found")
)
