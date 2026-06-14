package bookings

import "math"

func hardLimit(capacity int) int {
	return int(math.Ceil(float64(capacity) * 1.5))
}

func availabilityStatus(booked, capacity int) string {
	limit := hardLimit(capacity)
	switch {
	case booked >= limit:
		return "full"
	case booked >= capacity:
		return "busy"
	default:
		return "available"
	}
}

func isLocationFull(booked, capacity int) bool {
	return booked >= hardLimit(capacity)
}
