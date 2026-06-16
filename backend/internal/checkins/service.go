package checkins

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

type BookingChecker interface {
	HasConfirmedAtLocationOnDate(ctx context.Context, userID, locationID uuid.UUID, date time.Time) (bool, error)
}

type LocationReader interface {
	GetLocationByID(ctx context.Context, id string) (locations.LocationResponse, error)
}

type Service struct {
	store     Store
	bookings  BookingChecker
	locations LocationReader
}

func NewService(store Store, bookings BookingChecker, locations LocationReader) *Service {
	return &Service{store: store, bookings: bookings, locations: locations}
}

func (s *Service) CheckIn(ctx context.Context, p auth.Principal, locationID, dateStr string) error {
	if _, err := s.locations.GetLocationByID(ctx, locationID); err != nil {
		if errors.Is(err, locations.ErrLocationNotFound) {
			return locations.ErrLocationNotFound
		}
		return err
	}

	locUUID, err := uuid.Parse(locationID)
	if err != nil {
		return fmt.Errorf("invalid location id: %w", err)
	}

	checkInDate, err := bookings.ParseBookingDate(dateStr)
	if err != nil {
		return err
	}
	if err := bookings.ValidateBookingWindow(checkInDate); err != nil {
		return err
	}
	if !bookings.IsTodayInBucharest(checkInDate) {
		return ErrCheckInOnlyToday
	}

	hasBooking, err := s.bookings.HasConfirmedAtLocationOnDate(ctx, p.UserID, locUUID, checkInDate)
	if err != nil {
		return err
	}
	if !hasBooking {
		return ErrBookingRequired
	}

	_, err = s.store.Create(ctx, CheckIn{
		UserID:      p.UserID,
		LocationID:  locUUID,
		CheckInDate: checkInDate,
	})
	if errors.Is(err, ErrAlreadyCheckedIn) {
		return nil
	}
	return err
}

func (s *Service) ListVisible(ctx context.Context, p auth.Principal, locationID, dateStr string) ([]VisibleCheckInResponse, error) {
	if _, err := s.locations.GetLocationByID(ctx, locationID); err != nil {
		if errors.Is(err, locations.ErrLocationNotFound) {
			return nil, locations.ErrLocationNotFound
		}
		return nil, err
	}

	locUUID, err := uuid.Parse(locationID)
	if err != nil {
		return nil, fmt.Errorf("invalid location id: %w", err)
	}

	checkInDate, err := bookings.ParseBookingDate(dateStr)
	if err != nil {
		return nil, err
	}
	if err := bookings.ValidateBookingWindow(checkInDate); err != nil {
		return nil, err
	}

	items, err := s.store.ListVisible(ctx, p.UserID, locUUID, checkInDate)
	if err != nil {
		return nil, err
	}

	out := make([]VisibleCheckInResponse, 0, len(items))
	for _, item := range items {
		out = append(out, VisibleCheckInResponse{
			UserID:      item.UserID.String(),
			DisplayName: item.DisplayName,
			IsFriend:    item.IsFriend,
			AvatarURL:   item.AvatarURL,
		})
	}
	return out, nil
}
