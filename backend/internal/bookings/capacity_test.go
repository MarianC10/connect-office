package bookings

import "testing"

func TestAvailabilityStatus(t *testing.T) {
	tests := []struct {
		booked   int
		capacity int
		want     string
	}{
		{39, 40, "available"},
		{40, 40, "busy"},
		{59, 40, "busy"},
		{60, 40, "full"},
		{0, 30, "available"},
		{45, 30, "full"},
	}

	for _, tc := range tests {
		got := availabilityStatus(tc.booked, tc.capacity)
		if got != tc.want {
			t.Fatalf("availabilityStatus(%d, %d) = %q, want %q", tc.booked, tc.capacity, got, tc.want)
		}
	}
}

func TestHardLimit(t *testing.T) {
	if got := hardLimit(40); got != 60 {
		t.Fatalf("hardLimit(40) = %d, want 60", got)
	}
	if got := hardLimit(30); got != 45 {
		t.Fatalf("hardLimit(30) = %d, want 45", got)
	}
}
