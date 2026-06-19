package checkins

import "errors"

var (
	ErrCheckinsDisabled        = errors.New("check-ins are not enabled")
	ErrNoActiveSubscription    = errors.New("an active subscription is required to check in")
	ErrSubscriptionExpired     = errors.New("your subscription has expired")
	ErrNoEntrancesRemaining    = errors.New("no entrances remaining on your subscription")
	ErrLocationNotFound        = errors.New("location not found")
	ErrOutsideWorkingHours     = errors.New("this office is closed right now")
	ErrAlreadyCheckedIn        = errors.New("you are already checked in")
	ErrAlreadyCheckedInElsewhere = errors.New("you are still checked in at another office")
	ErrAlreadyVisitedToday     = errors.New("you have already checked in at this office today")
	ErrCheckInNotFound         = errors.New("check-in not found")
	ErrNotCheckInOwner         = errors.New("check-in not found")
)

type AlreadyCheckedInElsewhereError struct {
	LocationName string
}

func (e AlreadyCheckedInElsewhereError) Error() string {
	if e.LocationName == "" {
		return ErrAlreadyCheckedInElsewhere.Error()
	}
	return "you are still checked in at " + e.LocationName + ". check out first"
}

func (AlreadyCheckedInElsewhereError) Is(target error) bool {
	return target == ErrAlreadyCheckedInElsewhere
}
