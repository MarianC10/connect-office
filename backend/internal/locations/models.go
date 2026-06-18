package locations

type AmenityResponse struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}

type LocationImageResponse struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

type LocationResponse struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Address     string            `json:"address"`
	City        string            `json:"city"`
	County      string            `json:"county"`
	Country     string            `json:"country"`
	Latitude    float64           `json:"latitude"`
	Longitude   float64           `json:"longitude"`
	Capacity    int               `json:"capacity"`
	Timezone      string            `json:"timezone"`
	WeekdayOpen   string            `json:"weekday_open"`
	WeekdayClose  string            `json:"weekday_close"`
	WeekendOpen   string            `json:"weekend_open"`
	WeekendClose  string            `json:"weekend_close"`
	HoursOverrides map[string]HoursOverride `json:"hours_overrides,omitempty"`
	Images      []LocationImageResponse `json:"images"`
	Amenities   []AmenityResponse `json:"amenities"`
}
