package friends

import "github.com/google/uuid"

type RealtimeNotifier interface {
	NotifyFriendRequestNew(toUserID uuid.UUID, request FriendRequestResponse)
	NotifyFriendRequestAccepted(fromUserID uuid.UUID, friend FriendResponse)
}
