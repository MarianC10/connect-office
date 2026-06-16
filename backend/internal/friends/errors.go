package friends

import "errors"

var (
	ErrCannotFriendSelf      = errors.New("cannot send a friend request to yourself")
	ErrUserNotFound          = errors.New("user not found")
	ErrAlreadyFriends        = errors.New("already friends")
	ErrPendingRequestExists  = errors.New("friend request already pending")
	ErrRequestNotFound       = errors.New("friend request not found")
	ErrInvalidRequest        = errors.New("provide user_id or email, not both")
)
