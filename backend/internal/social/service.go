package social

import (
	"context"
	"errors"
	"fmt"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

type LocationReader interface {
	GetLocationByID(ctx context.Context, id string) (locations.LocationResponse, error)
}

type Service struct {
	store     Store
	locations LocationReader
}

func NewService(store Store, locations LocationReader) *Service {
	return &Service{store: store, locations: locations}
}

type VisibleBookingResponse struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	IsFriend    bool   `json:"is_friend"`
	AvatarURL   string `json:"avatar_url"`
}

func (s *Service) ListVisibleBookings(ctx context.Context, p auth.Principal, locationID, dateStr string) ([]VisibleBookingResponse, error) {
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

	bookingDate, err := bookings.ParseBookingDate(dateStr)
	if err != nil {
		return nil, err
	}
	if err := bookings.ValidateBookingWindow(bookingDate); err != nil {
		return nil, err
	}

	items, err := s.store.ListVisibleBookings(ctx, p.UserID, locUUID, bookingDate)
	if err != nil {
		return nil, err
	}

	out := make([]VisibleBookingResponse, 0, len(items))
	for _, item := range items {
		out = append(out, VisibleBookingResponse{
			UserID:      item.UserID.String(),
			DisplayName: item.DisplayName,
			IsFriend:    item.IsFriend,
			AvatarURL:   item.AvatarURL,
		})
	}
	return out, nil
}
