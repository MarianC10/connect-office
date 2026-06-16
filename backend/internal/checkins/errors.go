package checkins

import "errors"

var (
	ErrCheckInOnlyToday   = errors.New("check-in is only available for today")
	ErrBookingRequired    = errors.New("a confirmed booking at this office is required to check in")
	ErrAlreadyCheckedIn   = errors.New("already checked in at this office today")
)
