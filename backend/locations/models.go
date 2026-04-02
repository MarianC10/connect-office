package locations

type LocationResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Address     string   `json:"address"`
	City        string   `json:"city"`
	County      string   `json:"county"`
	Country     string   `json:"country"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	Amenities   []string `json:"amenities"`
}
