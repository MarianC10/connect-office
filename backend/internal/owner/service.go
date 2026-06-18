package owner

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
)

type UserStore interface {
	GetByID(ctx context.Context, userID uuid.UUID) (users.User, error)
}

type Service struct {
	store     Store
	users     UserStore
	cfg       Config
}

func NewService(store Store, users UserStore, cfg Config) *Service {
	return &Service{store: store, users: users, cfg: cfg}
}

func (s *Service) requireOwner(ctx context.Context, p auth.Principal) (users.User, error) {
	u, err := s.users.GetByID(ctx, p.UserID)
	if err != nil {
		return users.User{}, err
	}
	if !users.IsOwnerRole(u.Role) {
		return users.User{}, ErrNotOwner
	}
	return u, nil
}

func (s *Service) ListAmenities(ctx context.Context, p auth.Principal) ([]AmenityCatalogItem, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return nil, err
	}
	return s.store.ListAmenities(ctx)
}

func (s *Service) ListLocations(ctx context.Context, p auth.Principal) ([]OwnerLocationSummary, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return nil, err
	}
	return s.store.ListByOwnerID(ctx, p.UserID)
}

func (s *Service) GetLocation(ctx context.Context, p auth.Principal, locationID string) (OwnerLocationDetail, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return OwnerLocationDetail{}, err
	}
	id, err := uuid.Parse(locationID)
	if err != nil {
		return OwnerLocationDetail{}, fmt.Errorf("%w: invalid location id", ErrInvalidInput)
	}
	return s.store.GetLocationForOwner(ctx, p.UserID, id)
}

func (s *Service) CreateLocation(ctx context.Context, p auth.Principal, req CreateLocationRequest) (OwnerLocationDetail, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return OwnerLocationDetail{}, err
	}
	if err := validateCreateRequest(req); err != nil {
		return OwnerLocationDetail{}, err
	}
	return s.store.CreateLocation(ctx, p.UserID, req)
}

func (s *Service) UpdateLocation(ctx context.Context, p auth.Principal, locationID string, req UpdateLocationRequest) (OwnerLocationDetail, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return OwnerLocationDetail{}, err
	}
	id, err := uuid.Parse(locationID)
	if err != nil {
		return OwnerLocationDetail{}, fmt.Errorf("%w: invalid location id", ErrInvalidInput)
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return OwnerLocationDetail{}, fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	return s.store.UpdateLocation(ctx, p.UserID, id, req)
}

func (s *Service) UploadImage(ctx context.Context, p auth.Principal, locationID string, r io.Reader, contentType string, peek []byte) (UploadImageResponse, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return UploadImageResponse{}, err
	}
	id, err := uuid.Parse(locationID)
	if err != nil {
		return UploadImageResponse{}, fmt.Errorf("%w: invalid location id", ErrInvalidInput)
	}

	ct := detectImageContentType(contentType, peek)
	if ct == "" {
		return UploadImageResponse{}, fmt.Errorf("unsupported image type")
	}

	imageID := uuid.New().String()
	reader := io.MultiReader(bytes.NewReader(peek), r)
	url, err := saveLocationImage(s.cfg, id, imageID, reader, ct)
	if err != nil {
		return UploadImageResponse{}, err
	}

	img := LocationImage{ID: imageID, URL: url}
	if _, err := s.store.AppendImage(ctx, p.UserID, id, img); err != nil {
		return UploadImageResponse{}, err
	}
	return UploadImageResponse{Image: img}, nil
}

func (s *Service) DeleteImage(ctx context.Context, p auth.Principal, locationID, imageID string) error {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return err
	}
	id, err := uuid.Parse(locationID)
	if err != nil {
		return fmt.Errorf("%w: invalid location id", ErrInvalidInput)
	}
	imageID = strings.TrimSpace(imageID)
	if imageID == "" {
		return fmt.Errorf("%w: image id is required", ErrInvalidInput)
	}
	_, err = s.store.RemoveImage(ctx, p.UserID, id, imageID)
	return err
}

func (s *Service) ListBookings(ctx context.Context, p auth.Principal, dateStr, locationIDStr string) ([]OwnerBooking, error) {
	if _, err := s.requireOwner(ctx, p); err != nil {
		return nil, err
	}

	var date time.Time
	if strings.TrimSpace(dateStr) == "" {
		parsed, err := bookings.ParseBookingDate(bookings.TodayDateString())
		if err != nil {
			return nil, err
		}
		date = parsed
	} else {
		parsed, err := bookings.ParseBookingDate(dateStr)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
		}
		date = parsed
	}

	var locFilter *uuid.UUID
	if strings.TrimSpace(locationIDStr) != "" {
		id, err := uuid.Parse(locationIDStr)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid location_id", ErrInvalidInput)
		}
		locFilter = &id
	}

	return s.store.ListBookings(ctx, p.UserID, date, locFilter)
}

func validateCreateRequest(req CreateLocationRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	if strings.TrimSpace(req.Address) == "" {
		return fmt.Errorf("%w: address is required", ErrInvalidInput)
	}
	if strings.TrimSpace(req.City) == "" {
		return fmt.Errorf("%w: city is required", ErrInvalidInput)
	}
	if strings.TrimSpace(req.County) == "" {
		return fmt.Errorf("%w: county is required", ErrInvalidInput)
	}
	if strings.TrimSpace(req.Country) == "" {
		return fmt.Errorf("%w: country is required", ErrInvalidInput)
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		return fmt.Errorf("%w: latitude out of range", ErrInvalidInput)
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		return fmt.Errorf("%w: longitude out of range", ErrInvalidInput)
	}
	return nil
}
