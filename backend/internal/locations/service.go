package locations

import (
	"context"
	"fmt"
)

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) ListLocations(ctx context.Context) ([]LocationResponse, error) {
	items, err := s.store.ListLocations(ctx)
	if err != nil {
		return nil, err
	}
	for _, loc := range items {
		if err := validateLocationResponse(loc); err != nil {
			return nil, fmt.Errorf("location %q: %w", loc.ID, err)
		}
	}
	return items, nil
}

func validateLocationResponse(loc LocationResponse) error {
	if loc.ID == "" {
		return fmt.Errorf("location id is required")
	}
	if loc.Name == "" {
		return fmt.Errorf("location name is required")
	}
	if loc.Latitude < -90 || loc.Latitude > 90 {
		return fmt.Errorf("latitude out of range: %v", loc.Latitude)
	}
	if loc.Longitude < -180 || loc.Longitude > 180 {
		return fmt.Errorf("longitude out of range: %v", loc.Longitude)
	}
	return nil
}
