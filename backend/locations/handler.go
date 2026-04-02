package locations

import (
	"encoding/json"
	"net/http"
)

func GetLocationsHandler(respWriter http.ResponseWriter, req *http.Request) {
	body, err := json.Marshal([]LocationResponse{
		{
			ID:          "1",
			Name:        "Location 1",
			Description: "Description 1",
			Address:     "Address 1",
			City:        "City 1",
			County:      "County 1",
			Country:     "Country 1",
			Latitude:    46.779264,
			Longitude:   23.613201,
			Amenities:   []string{"Amenity 1", "Amenity 2", "Amenity 3"},
		},
		{
			ID:          "2",
			Name:        "Location 2",
			Description: "Description 2",
			Address:     "Address 2",
			City:        "City 2",
			County:      "County 2",
			Country:     "Country 2",
			Latitude:    46.779264,
			Longitude:   23.613201,
			Amenities:   []string{"Amenity 1", "Amenity 2", "Amenity 3"},
		},
		{
			ID:          "3",
			Name:        "Location 3",
			Description: "Description 3",
			Address:     "Address 3",
			City:        "City 3",
			County:      "County 3",
			Country:     "Country 3",
			Latitude:    46.779264,
			Longitude:   23.613201,
			Amenities:   []string{"Amenity 1", "Amenity 2", "Amenity 3"},
		},
	})
	if err != nil {
		http.Error(respWriter, err.Error(), http.StatusInternalServerError)
		return
	}
	respWriter.Header().Set("Content-Type", "application/json")
	respWriter.WriteHeader(http.StatusOK)
	respWriter.Write(body)
}
