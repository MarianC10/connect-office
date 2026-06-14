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
	Images      []LocationImageResponse `json:"images"`
	Amenities   []AmenityResponse `json:"amenities"`
}
