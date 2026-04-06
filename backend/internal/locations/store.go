package locations

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type Store interface {
	ListLocations(ctx context.Context) ([]LocationResponse, error)
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (p *PostgresStore) ListLocations(ctx context.Context) ([]LocationResponse, error) {
	var locs []Location
	err := p.db.WithContext(ctx).
		Preload("Amenities", func(db *gorm.DB) *gorm.DB {
			return db.Order("name ASC")
		}).
		Order("name ASC").
		Find(&locs).Error
	if err != nil {
		return nil, fmt.Errorf("list locations: %w", err)
	}

	out := make([]LocationResponse, 0, len(locs))
	for _, loc := range locs {
		out = append(out, locationToResponse(loc))
	}
	return out, nil
}

func locationToResponse(loc Location) LocationResponse {
	amenities := make([]AmenityResponse, 0, len(loc.Amenities))
	for _, a := range loc.Amenities {
		amenities = append(amenities, AmenityResponse{
			Name:     a.Name,
			Category: string(a.Category),
		})
	}
	return LocationResponse{
		ID:          loc.ID.String(),
		Name:        loc.Name,
		Description: loc.Description,
		Address:     loc.Address,
		City:        loc.City,
		County:      loc.County,
		Country:     loc.Country,
		Latitude:    loc.Latitude,
		Longitude:   loc.Longitude,
		Amenities:   amenities,
	}
}
