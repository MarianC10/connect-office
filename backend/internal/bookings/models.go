package bookings

import "time"

type CreateBookingRequest struct {
	LocationID  string `json:"location_id"`
	BookingDate string `json:"booking_date"`
}

type LocationSummary struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	City     string `json:"city"`
	ImageURL string `json:"image_url,omitempty"`
}

type BookingResponse struct {
	ID          string          `json:"id"`
	BookingDate string          `json:"booking_date"`
	Status      string          `json:"status"`
	Location    LocationSummary `json:"location"`
	CreatedAt   time.Time       `json:"created_at"`
}

type AvailabilityResponse struct {
	LocationID  string `json:"location_id"`
	BookingDate string `json:"booking_date"`
	Capacity    int    `json:"capacity"`
	BookedCount int    `json:"booked_count"`
	Status      string `json:"status"`
}
