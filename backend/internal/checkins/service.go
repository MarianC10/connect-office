package checkins

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/subscriptions"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LocationReader interface {
	GetLocationModel(ctx context.Context, id string) (locations.Location, error)
}

type SubscriptionReader interface {
	GetActiveByUserID(ctx context.Context, userID uuid.UUID) (subscriptions.UserSubscription, error)
}

type SubscriptionEntranceStore interface {
	DecrementEntrancesRemaining(ctx context.Context, tx *gorm.DB, userID uuid.UUID) error
}

type UserReader interface {
	GetDisplayNames(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]users.User, error)
}

type OwnerBookingLister interface {
	ListBookings(ctx context.Context, ownerID uuid.UUID, date time.Time, locationID *uuid.UUID) ([]ownerBookingRow, error)
}

type ownerBookingRow struct {
	ID               uuid.UUID
	LocationID       uuid.UUID
	LocationName     string
	BookingDate      time.Time
	RenterID         uuid.UUID
	RenterName       string
	RenterEmail      *string
	Status           string
	LocationImageURL string
}

type Service struct {
	store         Store
	locations     LocationReader
	subscriptions SubscriptionReader
	entrances     SubscriptionEntranceStore
	users         UserReader
	ownerBookings OwnerBookingLister
	cfg           Config
	now           func() time.Time
}

func NewService(
	store Store,
	locations LocationReader,
	subscriptions SubscriptionReader,
	entrances SubscriptionEntranceStore,
	users UserReader,
	ownerBookings OwnerBookingLister,
	cfg Config,
) *Service {
	return &Service{
		store:         store,
		locations:     locations,
		subscriptions: subscriptions,
		entrances:     entrances,
		users:         users,
		ownerBookings: ownerBookings,
		cfg:           cfg,
		now:           time.Now,
	}
}

func (s *Service) Enabled() bool {
	return s.cfg.IsEnabled()
}

func (s *Service) RunAutoCheckout(ctx context.Context) error {
	now := s.now().UTC()
	_, err := s.store.RunAutoCheckout(ctx, now, func(ctx context.Context, locationID uuid.UUID) (locations.Location, error) {
		return s.locations.GetLocationModel(ctx, locationID.String())
	})
	return err
}

func (s *Service) CheckIn(ctx context.Context, p auth.Principal, locationID string, req CreateCheckInRequest) (CheckInResponse, error) {
	if err := s.RunAutoCheckout(ctx); err != nil {
		return CheckInResponse{}, err
	}

	locID, err := uuid.Parse(locationID)
	if err != nil {
		return CheckInResponse{}, fmt.Errorf("invalid location id")
	}

	loc, err := s.locations.GetLocationModel(ctx, locationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return CheckInResponse{}, ErrLocationNotFound
		}
		return CheckInResponse{}, err
	}

	now := s.now().UTC() // server clock; never taken from the client request
	open, err := locations.IsWithinWorkingHours(loc, now)
	if err != nil {
		return CheckInResponse{}, err
	}
	if !open {
		return CheckInResponse{}, ErrOutsideWorkingHours
	}

	sub, err := s.subscriptions.GetActiveByUserID(ctx, p.UserID)
	if err != nil {
		return CheckInResponse{}, ErrNoActiveSubscription
	}
	if err := validateSubscription(sub, now); err != nil {
		return CheckInResponse{}, err
	}

	activeCI, activeLocName, activeErr := s.store.GetActiveByUserIDWithLocation(ctx, p.UserID)
	if activeErr == nil {
		if activeCI.LocationID == locID {
			return CheckInResponse{}, ErrAlreadyCheckedIn
		}
		return CheckInResponse{}, AlreadyCheckedInElsewhereError{LocationName: activeLocName}
	}
	if activeErr != nil && !errors.Is(activeErr, gorm.ErrRecordNotFound) {
		return CheckInResponse{}, activeErr
	}

	visitDate, err := locations.VisitDateInTimezone(loc.Timezone, now)
	if err != nil {
		return CheckInResponse{}, err
	}

	switch sub.PlanType {
	case subscriptions.PlanEntrances10:
		consumed, err := s.store.EntranceConsumedOnDate(ctx, p.UserID, locID, visitDate)
		if err != nil {
			return CheckInResponse{}, err
		}
		if !consumed {
			if sub.EntrancesRemaining == nil || *sub.EntrancesRemaining <= 0 {
				return CheckInResponse{}, ErrNoEntrancesRemaining
			}
		}
	case subscriptions.PlanMonthly, subscriptions.PlanYearly:
		visited, err := s.store.HasVisitOnDate(ctx, p.UserID, locID, visitDate)
		if err != nil {
			return CheckInResponse{}, err
		}
		if visited {
			return CheckInResponse{}, ErrAlreadyVisitedToday
		}
	default:
		return CheckInResponse{}, ErrNoActiveSubscription
	}

	consumeEntrance := false
	if sub.PlanType == subscriptions.PlanEntrances10 {
		consumed, err := s.store.EntranceConsumedOnDate(ctx, p.UserID, locID, visitDate)
		if err != nil {
			return CheckInResponse{}, err
		}
		consumeEntrance = !consumed
	}

	ci, err := s.store.CreateActiveCheckIn(ctx, CheckIn{
		UserID:           p.UserID,
		LocationID:       locID,
		VisitDate:        visitDate,
		CheckedInAt:      now,
		Status:           StatusActive,
		EntranceConsumed: consumeEntrance,
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
	}, consumeEntrance, p.UserID, func(ctx context.Context, tx *gorm.DB, userID uuid.UUID) error {
		if err := s.entrances.DecrementEntrancesRemaining(ctx, tx, userID); err != nil {
			if errors.Is(err, subscriptions.ErrNoEntrancesRemaining) {
				return ErrNoEntrancesRemaining
			}
			return err
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, ErrAlreadyCheckedInElsewhere) {
			return CheckInResponse{}, ErrAlreadyCheckedInElsewhere
		}
		return CheckInResponse{}, err
	}

	return checkInToResponse(ci, loc.Name), nil
}

func (s *Service) CheckOut(ctx context.Context, p auth.Principal, checkInID string) (CheckInResponse, error) {
	id, err := uuid.Parse(checkInID)
	if err != nil {
		return CheckInResponse{}, ErrCheckInNotFound
	}
	now := s.now().UTC()
	ci, err := s.store.CheckOut(ctx, id, p.UserID, now, StatusCheckedOut)
	if err != nil {
		return CheckInResponse{}, err
	}
	locName := ""
	if loc, locErr := s.locations.GetLocationModel(ctx, ci.LocationID.String()); locErr == nil {
		locName = loc.Name
	}
	return checkInToResponse(ci, locName), nil
}

func (s *Service) GetMine(ctx context.Context, p auth.Principal) (MyCheckInsResponse, error) {
	if err := s.RunAutoCheckout(ctx); err != nil {
		return MyCheckInsResponse{}, err
	}

	resp := MyCheckInsResponse{History: []CheckInResponse{}}
	if ci, locName, err := s.store.GetActiveByUserIDWithLocation(ctx, p.UserID); err == nil {
		active := checkInToResponse(ci, locName)
		resp.Active = &active
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return MyCheckInsResponse{}, err
	}

	items, err := s.store.ListRecentByUserID(ctx, p.UserID, 20)
	if err != nil {
		return MyCheckInsResponse{}, err
	}
	for _, ci := range items {
		if resp.Active != nil && ci.ID.String() == resp.Active.ID && ci.Status.IsActive() {
			continue
		}
		locName := ""
		if loc, locErr := s.locations.GetLocationModel(ctx, ci.LocationID.String()); locErr == nil {
			locName = loc.Name
		}
		resp.History = append(resp.History, checkInToResponse(ci, locName))
	}
	return resp, nil
}

func (s *Service) ListActiveAtLocation(ctx context.Context, locationID string) ([]ActiveUserResponse, error) {
	if err := s.RunAutoCheckout(ctx); err != nil {
		return nil, err
	}
	locID, err := uuid.Parse(locationID)
	if err != nil {
		return nil, fmt.Errorf("invalid location id")
	}
	if _, err := s.locations.GetLocationModel(ctx, locationID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrLocationNotFound
		}
		return nil, err
	}

	items, err := s.store.ListActiveByLocationID(ctx, locID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []ActiveUserResponse{}, nil
	}
	ids := make([]uuid.UUID, 0, len(items))
	for _, ci := range items {
		ids = append(ids, ci.UserID)
	}
	usersByID, err := s.users.GetDisplayNames(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]ActiveUserResponse, 0, len(items))
	for _, ci := range items {
		name := "Member"
		if u, ok := usersByID[ci.UserID]; ok && u.DisplayName != "" {
			name = u.DisplayName
		}
		out = append(out, ActiveUserResponse{
			UserID:      ci.UserID.String(),
			DisplayName: name,
			CheckedInAt: formatTime(ci.CheckedInAt),
		})
	}
	return out, nil
}

func (s *Service) OwnerPresence(ctx context.Context, ownerID uuid.UUID, dateStr, locationIDStr string) (OwnerPresenceResponse, error) {
	if err := s.RunAutoCheckout(ctx); err != nil {
		return OwnerPresenceResponse{}, err
	}

	var date time.Time
	if dateStr == "" {
		parsed, err := bookings.ParseBookingDate(bookings.TodayDateString())
		if err != nil {
			return OwnerPresenceResponse{}, err
		}
		date = parsed
	} else {
		parsed, err := bookings.ParseBookingDate(dateStr)
		if err != nil {
			return OwnerPresenceResponse{}, fmt.Errorf("invalid date")
		}
		date = parsed
	}

	var locFilter *uuid.UUID
	if locationIDStr != "" {
		id, err := uuid.Parse(locationIDStr)
		if err != nil {
			return OwnerPresenceResponse{}, fmt.Errorf("invalid location_id")
		}
		locFilter = &id
	}

	bookingRows, err := s.ownerBookings.ListBookings(ctx, ownerID, date, locFilter)
	if err != nil {
		return OwnerPresenceResponse{}, err
	}

	userIDs := make([]uuid.UUID, 0, len(bookingRows))
	locationIDs := make([]uuid.UUID, 0, len(bookingRows))
	for _, b := range bookingRows {
		userIDs = append(userIDs, b.RenterID)
		locationIDs = append(locationIDs, b.LocationID)
	}
	activeByUser, err := s.store.ListActiveByUserIDsAtLocations(ctx, userIDs, locationIDs)
	if err != nil {
		return OwnerPresenceResponse{}, err
	}

	bookingsOut := make([]OwnerPresenceBooking, 0, len(bookingRows))
	for _, b := range bookingRows {
		email := ""
		if b.RenterEmail != nil {
			email = *b.RenterEmail
		}
		item := OwnerPresenceBooking{
			ID:               b.ID.String(),
			LocationID:       b.LocationID.String(),
			LocationName:     b.LocationName,
			BookingDate:      bookings.FormatBookingDate(b.BookingDate),
			RenterID:         b.RenterID.String(),
			RenterName:       b.RenterName,
			RenterEmail:      email,
			Status:           b.Status,
			LocationImageURL: b.LocationImageURL,
		}
		if ci, ok := activeByUser[b.RenterID]; ok && ci.LocationID == b.LocationID {
			item.CheckedIn = true
			item.CheckedInAt = formatTime(ci.CheckedInAt)
		}
		bookingsOut = append(bookingsOut, item)
	}

	activeRows, err := s.store.ListActiveForOwner(ctx, ownerID, locFilter)
	if err != nil {
		return OwnerPresenceResponse{}, err
	}
	checkedInOut := make([]OwnerPresenceCheckedIn, 0, len(activeRows))
	for _, row := range activeRows {
		email := ""
		if row.Email != nil {
			email = *row.Email
		}
		checkedInOut = append(checkedInOut, OwnerPresenceCheckedIn{
			UserID:       row.UserID.String(),
			DisplayName:  row.DisplayName,
			Email:        email,
			LocationID:   row.LocationID.String(),
			LocationName: row.LocationName,
			CheckedInAt:  formatTime(row.CheckedInAt),
		})
	}

	return OwnerPresenceResponse{
		Bookings:  bookingsOut,
		CheckedIn: checkedInOut,
	}, nil
}

func validateSubscription(sub subscriptions.UserSubscription, now time.Time) error {
	switch sub.PlanType {
	case subscriptions.PlanEntrances10:
		if sub.EntrancesRemaining != nil && *sub.EntrancesRemaining <= 0 {
			return ErrNoEntrancesRemaining
		}
	case subscriptions.PlanMonthly, subscriptions.PlanYearly:
		if sub.ExpiresAt != nil && !sub.ExpiresAt.After(now) {
			return ErrSubscriptionExpired
		}
	default:
		return ErrNoActiveSubscription
	}
	return nil
}

func checkInToResponse(ci CheckIn, locationName string) CheckInResponse {
	resp := CheckInResponse{
		ID:               ci.ID.String(),
		LocationID:       ci.LocationID.String(),
		LocationName:     locationName,
		VisitDate:        locations.FormatVisitDate(ci.VisitDate),
		CheckedInAt:      formatTime(ci.CheckedInAt),
		Status:           string(ci.Status),
		EntranceConsumed: ci.EntranceConsumed,
	}
	if ci.CheckedOutAt != nil {
		t := formatTime(*ci.CheckedOutAt)
		resp.CheckedOutAt = &t
	}
	return resp
}
