package bookings

import (
	"context"
	"errors"
	"fmt"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LocationReader interface {
	GetLocationByID(ctx context.Context, id string) (locations.LocationResponse, error)
}

type UserProvisioner interface {
	UpsertFromPrincipal(ctx context.Context, p auth.Principal) (users.User, error)
}

type Service struct {
	store     Store
	locations LocationReader
	users     UserProvisioner
}

var (
	ErrBookingDateOutOfRange = errors.New("booking date must be within the next 10 days")
	ErrBookingAlreadyExists  = errors.New("you already have a booking on this day")
	ErrLocationFull          = errors.New("this office is fully booked for this day")
	ErrBookingNotFound       = errors.New("booking not found")
)

func NewService(store Store, locations LocationReader, users UserProvisioner) *Service {
	return &Service{store: store, locations: locations, users: users}
}

func (s *Service) Create(ctx context.Context, p auth.Principal, req CreateBookingRequest) (BookingResponse, error) {
	if _, err := s.users.UpsertFromPrincipal(ctx, p); err != nil {
		return BookingResponse{}, fmt.Errorf("provision user: %w", err)
	}

	locationID, err := uuid.Parse(req.LocationID)
	if err != nil {
		return BookingResponse{}, fmt.Errorf("invalid location_id: %w", err)
	}

	bookingDate, err := parseBookingDate(req.BookingDate)
	if err != nil {
		return BookingResponse{}, err
	}
	if err := validateBookingWindow(bookingDate); err != nil {
		return BookingResponse{}, err
	}

	loc, err := s.locations.GetLocationByID(ctx, req.LocationID)
	if err != nil {
		if errors.Is(err, locations.ErrLocationNotFound) {
			return BookingResponse{}, locations.ErrLocationNotFound
		}
		return BookingResponse{}, err
	}

	hasBooking, err := s.store.HasConfirmedForUserOnDate(ctx, p.UserID, bookingDate)
	if err != nil {
		return BookingResponse{}, err
	}
	if hasBooking {
		return BookingResponse{}, ErrBookingAlreadyExists
	}

	booked, err := s.store.CountConfirmedByLocationDate(ctx, locationID, bookingDate)
	if err != nil {
		return BookingResponse{}, err
	}
	if isLocationFull(booked, loc.Capacity) {
		return BookingResponse{}, ErrLocationFull
	}

	b, err := s.store.Create(ctx, Booking{
		UserID:      p.UserID,
		LocationID:  locationID,
		BookingDate: bookingDate,
		Status:      BookingStatusConfirmed,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return BookingResponse{}, ErrBookingAlreadyExists
		}
		return BookingResponse{}, err
	}

	return bookingToResponse(b, loc), nil
}

func (s *Service) List(ctx context.Context, p auth.Principal) ([]BookingResponse, error) {
	items, err := s.store.ListConfirmedByUser(ctx, p.UserID)
	if err != nil {
		return nil, err
	}

	out := make([]BookingResponse, 0, len(items))
	for _, b := range items {
		loc, err := s.locations.GetLocationByID(ctx, b.LocationID.String())
		if err != nil {
			return nil, fmt.Errorf("load location %s: %w", b.LocationID, err)
		}
		out = append(out, bookingToResponse(b, loc))
	}
	return out, nil
}

func (s *Service) Cancel(ctx context.Context, p auth.Principal, bookingID string) error {
	id, err := uuid.Parse(bookingID)
	if err != nil {
		return fmt.Errorf("invalid booking id: %w", err)
	}

	b, err := s.store.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrBookingNotFound
		}
		return err
	}
	if b.UserID != p.UserID {
		return ErrBookingNotFound
	}
	if b.Status != BookingStatusConfirmed {
		return ErrBookingNotFound
	}

	if err := s.store.Cancel(ctx, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrBookingNotFound
		}
		return err
	}
	return nil
}

func (s *Service) Availability(ctx context.Context, locationID string, dateStr string) (AvailabilityResponse, error) {
	loc, err := s.locations.GetLocationByID(ctx, locationID)
	if err != nil {
		if errors.Is(err, locations.ErrLocationNotFound) {
			return AvailabilityResponse{}, locations.ErrLocationNotFound
		}
		return AvailabilityResponse{}, err
	}

	bookingDate, err := parseBookingDate(dateStr)
	if err != nil {
		return AvailabilityResponse{}, err
	}
	if err := validateBookingWindow(bookingDate); err != nil {
		return AvailabilityResponse{}, err
	}

	locUUID, err := uuid.Parse(loc.ID)
	if err != nil {
		return AvailabilityResponse{}, fmt.Errorf("invalid location id: %w", err)
	}

	booked, err := s.store.CountConfirmedByLocationDate(ctx, locUUID, bookingDate)
	if err != nil {
		return AvailabilityResponse{}, err
	}

	return AvailabilityResponse{
		LocationID:  loc.ID,
		BookingDate: formatBookingDate(bookingDate),
		Capacity:    loc.Capacity,
		BookedCount: booked,
		Status:      availabilityStatus(booked, loc.Capacity),
	}, nil
}

func bookingToResponse(b Booking, loc locations.LocationResponse) BookingResponse {
	summary := LocationSummary{
		ID:   loc.ID,
		Name: loc.Name,
		City: loc.City,
	}
	if len(loc.Images) > 0 {
		summary.ImageURL = loc.Images[0].URL
	}
	return BookingResponse{
		ID:          b.ID.String(),
		BookingDate: formatBookingDate(b.BookingDate),
		Status:      string(b.Status),
		Location:    summary,
		CreatedAt:   b.CreatedAt,
	}
}
