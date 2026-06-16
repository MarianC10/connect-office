package users

import "errors"

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrInvalidDisplayName  = errors.New("display_name must be 2-64 characters")
	ErrSearchQueryTooShort = errors.New("search query must be at least 2 characters")
	ErrRateLimited         = errors.New("too many requests")
)
