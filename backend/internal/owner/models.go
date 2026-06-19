package owner

import "github.com/MarianC10/connect-office/backend/internal/locations"

type AmenityCatalogItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

type OwnerLocationSummary struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	City         string `json:"city"`
	ImageURL     string `json:"image_url,omitempty"`
	BookingCount int    `json:"booking_count"`
}

type OwnerLocationDetail struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Address     string                `json:"address"`
	City        string                `json:"city"`
	County      string                `json:"county"`
	Country     string                `json:"country"`
	Latitude    float64               `json:"latitude"`
	Longitude   float64               `json:"longitude"`
	Capacity    int                   `json:"capacity"`
	Timezone      string                `json:"timezone"`
	WeekdayOpen   string                `json:"weekday_open"`
	WeekdayClose  string                `json:"weekday_close"`
	WeekendOpen   string                `json:"weekend_open"`
	WeekendClose  string                `json:"weekend_close"`
	HoursOverrides map[string]locations.HoursOverride `json:"hours_overrides,omitempty"`
	Images      []LocationImage       `json:"images"`
	AmenityIDs  []string              `json:"amenity_ids"`
	Amenities   []AmenityCatalogItem  `json:"amenities"`
}

type LocationImage struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

type CreateLocationRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Address     string   `json:"address"`
	City        string   `json:"city"`
	County      string   `json:"county"`
	Country     string   `json:"country"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	Capacity    int      `json:"capacity"`
	Timezone      string   `json:"timezone"`
	WeekdayOpen   string   `json:"weekday_open"`
	WeekdayClose  string   `json:"weekday_close"`
	WeekendOpen   string   `json:"weekend_open"`
	WeekendClose  string   `json:"weekend_close"`
	AmenityIDs  []string `json:"amenity_ids"`
}

type UpdateLocationRequest struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Timezone      *string       `json:"timezone,omitempty"`
	WeekdayOpen   *string       `json:"weekday_open,omitempty"`
	WeekdayClose  *string       `json:"weekday_close,omitempty"`
	WeekendOpen   *string       `json:"weekend_open,omitempty"`
	WeekendClose  *string       `json:"weekend_close,omitempty"`
	AmenityIDs  []string        `json:"amenity_ids,omitempty"`
	Images      []LocationImage `json:"images,omitempty"`
}

type OwnerBooking struct {
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

type OwnerCheckedInUser struct {
	UserID       string `json:"user_id"`
	DisplayName  string `json:"display_name"`
	Email        string `json:"email"`
	LocationID   string `json:"location_id"`
	LocationName string `json:"location_name"`
	CheckedInAt  string `json:"checked_in_at"`
}

type OwnerPresenceResponse struct {
	Bookings  []OwnerBooking       `json:"bookings"`
	CheckedIn []OwnerCheckedInUser `json:"checked_in"`
}

type UploadImageResponse struct {
	Image LocationImage `json:"image"`
}
