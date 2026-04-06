package locations

import (
	"context"
	"errors"
	"fmt"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) ListLocations(_ context.Context) ([]LocationResponse, error) {
	entities := seedLocations()
	out := make([]LocationResponse, 0, len(entities))
	for _, loc := range entities {
		if err := loc.validate(); err != nil {
			return nil, fmt.Errorf("location %q: %w", loc.ID, err)
		}
		out = append(out, toLocationResponse(loc))
	}
	return out, nil
}

type location struct {
	ID          string
	Name        string
	Description string
	Address     string
	City        string
	County      string
	Country     string
	Latitude    float64
	Longitude   float64
	Amenities   []string
}

func (l location) validate() error {
	if l.ID == "" {
		return errors.New("location id is required")
	}
	if l.Name == "" {
		return errors.New("location name is required")
	}
	if l.Latitude < -90 || l.Latitude > 90 {
		return fmt.Errorf("latitude out of range: %v", l.Latitude)
	}
	if l.Longitude < -180 || l.Longitude > 180 {
		return fmt.Errorf("longitude out of range: %v", l.Longitude)
	}
	return nil
}

func seedLocations() []location {
	return []location{
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
	}
}

func toLocationResponse(loc location) LocationResponse {
	return LocationResponse{
		ID:          loc.ID,
		Name:        loc.Name,
		Description: loc.Description,
		Address:     loc.Address,
		City:        loc.City,
		County:      loc.County,
		Country:     loc.Country,
		Latitude:    loc.Latitude,
		Longitude:   loc.Longitude,
		Amenities:   append([]string(nil), loc.Amenities...),
	}
}
