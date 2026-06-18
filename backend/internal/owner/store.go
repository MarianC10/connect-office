package owner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Store interface {
	ListAmenities(ctx context.Context) ([]AmenityCatalogItem, error)
	ListByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]OwnerLocationSummary, error)
	GetLocationForOwner(ctx context.Context, ownerID, locationID uuid.UUID) (OwnerLocationDetail, error)
	CreateLocation(ctx context.Context, ownerID uuid.UUID, req CreateLocationRequest) (OwnerLocationDetail, error)
	UpdateLocation(ctx context.Context, ownerID, locationID uuid.UUID, req UpdateLocationRequest) (OwnerLocationDetail, error)
	AppendImage(ctx context.Context, ownerID, locationID uuid.UUID, img LocationImage) (OwnerLocationDetail, error)
	RemoveImage(ctx context.Context, ownerID, locationID uuid.UUID, imageID string) (OwnerLocationDetail, error)
	ListBookings(ctx context.Context, ownerID uuid.UUID, date time.Time, locationID *uuid.UUID) ([]OwnerBooking, error)
}

type PostgresStore struct {
	db *gorm.DB
}

func NewPostgresStore(db *gorm.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) ListAmenities(ctx context.Context) ([]AmenityCatalogItem, error) {
	var items []locations.Amenity
	err := s.db.WithContext(ctx).Order("name ASC").Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("list amenities: %w", err)
	}
	out := make([]AmenityCatalogItem, 0, len(items))
	for _, a := range items {
		out = append(out, AmenityCatalogItem{
			ID:       a.ID.String(),
			Name:     a.Name,
			Category: string(a.Category),
		})
	}
	return out, nil
}

func (s *PostgresStore) ListByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]OwnerLocationSummary, error) {
	var locs []locations.Location
	err := s.db.WithContext(ctx).
		Where("owner_id = ?", ownerID).
		Order("name ASC").
		Find(&locs).Error
	if err != nil {
		return nil, fmt.Errorf("list owner locations: %w", err)
	}

	out := make([]OwnerLocationSummary, 0, len(locs))
	for _, loc := range locs {
		var count int64
		if err := s.db.WithContext(ctx).
			Model(&bookings.Booking{}).
			Where("location_id = ? AND status = ?", loc.ID, bookings.BookingStatusConfirmed).
			Count(&count).Error; err != nil {
			return nil, fmt.Errorf("count bookings: %w", err)
		}
		summary := OwnerLocationSummary{
			ID:           loc.ID.String(),
			Name:         loc.Name,
			City:         loc.City,
			BookingCount: int(count),
		}
		if len(loc.Images) > 0 {
			summary.ImageURL = loc.Images[0].URL
		}
		out = append(out, summary)
	}
	return out, nil
}

func (s *PostgresStore) GetLocationForOwner(ctx context.Context, ownerID, locationID uuid.UUID) (OwnerLocationDetail, error) {
	var loc locations.Location
	err := s.db.WithContext(ctx).
		Preload("Amenities", func(db *gorm.DB) *gorm.DB {
			return db.Order("name ASC")
		}).
		Where("id = ? AND owner_id = ?", locationID, ownerID).
		First(&loc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return OwnerLocationDetail{}, ErrLocationNotFound
		}
		return OwnerLocationDetail{}, fmt.Errorf("get location: %w", err)
	}
	return locationToDetail(loc), nil
}

func (s *PostgresStore) CreateLocation(ctx context.Context, ownerID uuid.UUID, req CreateLocationRequest) (OwnerLocationDetail, error) {
	capacity := req.Capacity
	if capacity <= 0 {
		capacity = 40
	}

	amenityIDs, err := parseAmenityIDs(req.AmenityIDs)
	if err != nil {
		return OwnerLocationDetail{}, err
	}

	loc := locations.Location{
		Name:        req.Name,
		Description: req.Description,
		Address:     req.Address,
		City:        req.City,
		County:      req.County,
		Country:     req.Country,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Capacity:    capacity,
		OwnerID:     &ownerID,
		Images:      locations.LocationImageList{},
		Timezone:     defaultTimezone(req.Timezone),
		WeekdayOpen:  defaultClock(req.WeekdayOpen, "09:00"),
		WeekdayClose: defaultClock(req.WeekdayClose, "18:00"),
		WeekendOpen:  defaultClock(req.WeekendOpen, "10:00"),
		WeekendClose: defaultClock(req.WeekendClose, "16:00"),
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&loc).Error; err != nil {
			return fmt.Errorf("create location: %w", err)
		}
		if len(amenityIDs) > 0 {
			if err := linkAmenities(tx, loc.ID, amenityIDs); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return OwnerLocationDetail{}, err
	}

	return s.GetLocationForOwner(ctx, ownerID, loc.ID)
}

func (s *PostgresStore) UpdateLocation(ctx context.Context, ownerID, locationID uuid.UUID, req UpdateLocationRequest) (OwnerLocationDetail, error) {
	var loc locations.Location
	err := s.db.WithContext(ctx).
		Where("id = ? AND owner_id = ?", locationID, ownerID).
		First(&loc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return OwnerLocationDetail{}, ErrLocationNotFound
		}
		return OwnerLocationDetail{}, fmt.Errorf("load location: %w", err)
	}

	updates := map[string]any{
		"updated_at": time.Now().UTC(),
	}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Timezone != nil {
		updates["timezone"] = defaultTimezone(*req.Timezone)
	}
	if req.WeekdayOpen != nil {
		updates["weekday_open"] = defaultClock(*req.WeekdayOpen, "09:00")
	}
	if req.WeekdayClose != nil {
		updates["weekday_close"] = defaultClock(*req.WeekdayClose, "18:00")
	}
	if req.WeekendOpen != nil {
		updates["weekend_open"] = defaultClock(*req.WeekendOpen, "10:00")
	}
	if req.WeekendClose != nil {
		updates["weekend_close"] = defaultClock(*req.WeekendClose, "16:00")
	}
	if req.Images != nil {
		imgs := make(locations.LocationImageList, 0, len(req.Images))
		for _, img := range req.Images {
			imgs = append(imgs, locations.LocationImage{ID: img.ID, URL: img.URL})
		}
		imagesJSON, err := json.Marshal([]locations.LocationImage(imgs))
		if err != nil {
			return OwnerLocationDetail{}, fmt.Errorf("marshal images: %w", err)
		}
		updates["images"] = imagesJSON
	}

	var amenityIDs []uuid.UUID
	if req.AmenityIDs != nil {
		amenityIDs, err = parseAmenityIDs(req.AmenityIDs)
		if err != nil {
			return OwnerLocationDetail{}, err
		}
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(updates) > 1 {
			if err := tx.Model(&locations.Location{}).Where("id = ?", locationID).Updates(updates).Error; err != nil {
				return fmt.Errorf("update location: %w", err)
			}
		}
		if req.AmenityIDs != nil {
			if err := tx.Where("location_id = ?", locationID).Delete(&locationAmenityRow{}).Error; err != nil {
				return fmt.Errorf("clear amenities: %w", err)
			}
			if len(amenityIDs) > 0 {
				if err := linkAmenities(tx, locationID, amenityIDs); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return OwnerLocationDetail{}, err
	}

	return s.GetLocationForOwner(ctx, ownerID, locationID)
}

func (s *PostgresStore) AppendImage(ctx context.Context, ownerID, locationID uuid.UUID, img LocationImage) (OwnerLocationDetail, error) {
	detail, err := s.GetLocationForOwner(ctx, ownerID, locationID)
	if err != nil {
		return OwnerLocationDetail{}, err
	}

	images := append(detail.Images, img)
	_, err = s.UpdateLocation(ctx, ownerID, locationID, UpdateLocationRequest{Images: images})
	if err != nil {
		return OwnerLocationDetail{}, err
	}
	return s.GetLocationForOwner(ctx, ownerID, locationID)
}

func (s *PostgresStore) RemoveImage(ctx context.Context, ownerID, locationID uuid.UUID, imageID string) (OwnerLocationDetail, error) {
	detail, err := s.GetLocationForOwner(ctx, ownerID, locationID)
	if err != nil {
		return OwnerLocationDetail{}, err
	}

	found := false
	images := make([]LocationImage, 0, len(detail.Images))
	for _, img := range detail.Images {
		if img.ID == imageID {
			found = true
			continue
		}
		images = append(images, img)
	}
	if !found {
		return OwnerLocationDetail{}, ErrImageNotFound
	}

	_, err = s.UpdateLocation(ctx, ownerID, locationID, UpdateLocationRequest{Images: images})
	if err != nil {
		return OwnerLocationDetail{}, err
	}
	return s.GetLocationForOwner(ctx, ownerID, locationID)
}

func (s *PostgresStore) ListBookings(ctx context.Context, ownerID uuid.UUID, date time.Time, locationID *uuid.UUID) ([]OwnerBooking, error) {
	type row struct {
		BookingID    uuid.UUID
		LocationID   uuid.UUID
		LocationName string
		BookingDate  time.Time
		Status       string
		RenterID     uuid.UUID
		RenterName   string
		RenterEmail  *string
		Images       locations.LocationImageList `gorm:"column:images;type:jsonb"`
	}

	q := s.db.WithContext(ctx).
		Table("bookings b").
		Select(`b.id AS booking_id, b.location_id, l.name AS location_name, b.booking_date, b.status,
			u.id AS renter_id, u.display_name AS renter_name, u.email AS renter_email, l.images`).
		Joins("JOIN locations l ON l.id = b.location_id").
		Joins("JOIN users u ON u.id = b.user_id").
		Where("l.owner_id = ? AND b.booking_date = ? AND b.status = ?", ownerID, date, bookings.BookingStatusConfirmed)

	if locationID != nil {
		q = q.Where("b.location_id = ?", *locationID)
	}

	var rows []row
	if err := q.Order("l.name ASC, u.display_name ASC").Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("list owner bookings: %w", err)
	}

	out := make([]OwnerBooking, 0, len(rows))
	for _, r := range rows {
		email := ""
		if r.RenterEmail != nil {
			email = *r.RenterEmail
		}
		ob := OwnerBooking{
			ID:           r.BookingID.String(),
			LocationID:   r.LocationID.String(),
			LocationName: r.LocationName,
			BookingDate:  bookings.FormatBookingDate(r.BookingDate),
			RenterID:     r.RenterID.String(),
			RenterName:   r.RenterName,
			RenterEmail:  email,
			Status:       r.Status,
		}
		if len(r.Images) > 0 {
			ob.LocationImageURL = r.Images.Slice()[0].URL
		}
		out = append(out, ob)
	}
	return out, nil
}

type locationAmenityRow struct {
	LocationID uuid.UUID `gorm:"column:location_id"`
	AmenityID  uuid.UUID `gorm:"column:amenity_id"`
}

func (locationAmenityRow) TableName() string {
	return "location_amenities"
}

func linkAmenities(tx *gorm.DB, locationID uuid.UUID, amenityIDs []uuid.UUID) error {
	for _, aid := range amenityIDs {
		row := locationAmenityRow{LocationID: locationID, AmenityID: aid}
		if err := tx.Create(&row).Error; err != nil {
			return fmt.Errorf("link amenity %s: %w", aid, err)
		}
	}
	return nil
}

func parseAmenityIDs(ids []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		parsed, err := uuid.Parse(id)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid amenity id %q", ErrInvalidInput, id)
		}
		out = append(out, parsed)
	}
	return out, nil
}

func locationToDetail(loc locations.Location) OwnerLocationDetail {
	images := make([]LocationImage, 0, len(loc.Images))
	for _, img := range loc.Images.Slice() {
		images = append(images, LocationImage{ID: img.ID, URL: img.URL})
	}
	amenities := make([]AmenityCatalogItem, 0, len(loc.Amenities))
	amenityIDs := make([]string, 0, len(loc.Amenities))
	for _, a := range loc.Amenities {
		id := a.ID.String()
		amenityIDs = append(amenityIDs, id)
		amenities = append(amenities, AmenityCatalogItem{
			ID:       id,
			Name:     a.Name,
			Category: string(a.Category),
		})
	}
	return OwnerLocationDetail{
		ID:          loc.ID.String(),
		Name:        loc.Name,
		Description: loc.Description,
		Address:     loc.Address,
		City:        loc.City,
		County:      loc.County,
		Country:     loc.Country,
		Latitude:    loc.Latitude,
		Longitude:   loc.Longitude,
		Capacity:    loc.Capacity,
		Timezone:      loc.Timezone,
		WeekdayOpen:   normalizeOwnerClock(loc.WeekdayOpen),
		WeekdayClose:  normalizeOwnerClock(loc.WeekdayClose),
		WeekendOpen:   normalizeOwnerClock(loc.WeekendOpen),
		WeekendClose:  normalizeOwnerClock(loc.WeekendClose),
		HoursOverrides: loc.HoursOverrides.Map(),
		Images:      images,
		AmenityIDs:  amenityIDs,
		Amenities:   amenities,
	}
}

func defaultTimezone(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return locations.DefaultTimezone()
	}
	return value
}

func defaultClock(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func normalizeOwnerClock(clock string) string {
	clock = strings.TrimSpace(clock)
	if len(clock) >= 5 {
		return clock[:5]
	}
	return clock
}
