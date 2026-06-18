package owner

import "errors"

var (
	ErrForbidden       = errors.New("forbidden")
	ErrNotOwner        = errors.New("user is not an owner")
	ErrLocationNotFound = errors.New("location not found")
	ErrImageNotFound   = errors.New("image not found")
	ErrInvalidInput    = errors.New("invalid input")
)
