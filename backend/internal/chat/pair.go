package chat

import (
	"strings"

	"github.com/google/uuid"
)

func CanonicalPair(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if strings.Compare(a.String(), b.String()) < 0 {
		return a, b
	}
	return b, a
}

func OtherParticipant(conv Conversation, userID uuid.UUID) (uuid.UUID, bool) {
	if conv.UserAID == userID {
		return conv.UserBID, true
	}
	if conv.UserBID == userID {
		return conv.UserAID, true
	}
	return uuid.Nil, false
}
