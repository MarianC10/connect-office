package users

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type emailLookupLimiter struct {
	mu       sync.Mutex
	windows  map[uuid.UUID][]time.Time
	limit    int
	duration time.Duration
}

func newEmailLookupLimiter(limit int, duration time.Duration) *emailLookupLimiter {
	return &emailLookupLimiter{
		windows:  make(map[uuid.UUID][]time.Time),
		limit:    limit,
		duration: duration,
	}
}

func (l *emailLookupLimiter) allow(userID uuid.UUID) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-l.duration)
	times := l.windows[userID]
	filtered := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	if len(filtered) >= l.limit {
		l.windows[userID] = filtered
		return false
	}
	filtered = append(filtered, now)
	l.windows[userID] = filtered
	return true
}
