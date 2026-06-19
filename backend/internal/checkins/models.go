package checkins

import "time"

type CreateCheckInRequest struct {
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}

type CheckInResponse struct {
	ID               string  `json:"id"`
	LocationID       string  `json:"location_id"`
	LocationName     string  `json:"location_name,omitempty"`
	VisitDate        string  `json:"visit_date"`
	CheckedInAt      string  `json:"checked_in_at"`
	CheckedOutAt     *string `json:"checked_out_at,omitempty"`
	Status           string  `json:"status"`
	EntranceConsumed bool    `json:"entrance_consumed"`
}

type ActiveCheckInResponse struct {
	CheckInResponse
}

type MyCheckInsResponse struct {
	Active  *CheckInResponse  `json:"active,omitempty"`
	History []CheckInResponse `json:"history"`
}

type ActiveUserResponse struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	CheckedInAt string `json:"checked_in_at"`
}

type OwnerPresenceBooking struct {
	ID              string `json:"id"`
	LocationID      string `json:"location_id"`
	LocationName    string `json:"location_name"`
	BookingDate     string `json:"booking_date"`
	RenterID        string `json:"renter_id"`
	RenterName      string `json:"renter_name"`
	RenterEmail     string `json:"renter_email"`
	Status          string `json:"status"`
	CheckedIn       bool   `json:"checked_in"`
	CheckedInAt     string `json:"checked_in_at,omitempty"`
	LocationImageURL string `json:"location_image_url,omitempty"`
}

type OwnerPresenceCheckedIn struct {
	UserID       string `json:"user_id"`
	DisplayName  string `json:"display_name"`
	Email        string `json:"email"`
	LocationID   string `json:"location_id"`
	LocationName string `json:"location_name"`
	CheckedInAt  string `json:"checked_in_at"`
}

type OwnerPresenceResponse struct {
	Bookings  []OwnerPresenceBooking   `json:"bookings"`
	CheckedIn []OwnerPresenceCheckedIn `json:"checked_in"`
}

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}
