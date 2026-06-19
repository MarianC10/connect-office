package checkins

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/subscriptions"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type fakeCheckinStore struct {
	active             *CheckIn
	activeLocName      string
	activeErr          error
	visitExists        bool
	entranceConsumed   bool
	created            []CheckIn
	checkOut           CheckIn
	autoCheckoutCalled bool
	ownerActive        []activeOwnerRow
	activeByUser       map[uuid.UUID]CheckIn
}

func (f *fakeCheckinStore) RunAutoCheckout(ctx context.Context, now time.Time, loadLocation func(context.Context, uuid.UUID) (locations.Location, error)) (int, error) {
	f.autoCheckoutCalled = true
	return 0, nil
}

func (f *fakeCheckinStore) GetActiveByUserID(ctx context.Context, userID uuid.UUID) (CheckIn, error) {
	if f.active != nil {
		return *f.active, nil
	}
	return CheckIn{}, gorm.ErrRecordNotFound
}

func (f *fakeCheckinStore) GetActiveByUserIDWithLocation(ctx context.Context, userID uuid.UUID) (CheckIn, string, error) {
  if f.active != nil {
    return *f.active, f.activeLocName, nil
  }
  if f.activeErr != nil {
    return CheckIn{}, "", f.activeErr
  }
  return CheckIn{}, "", gorm.ErrRecordNotFound
}

func (f *fakeCheckinStore) ListActiveByLocationID(ctx context.Context, locationID uuid.UUID) ([]CheckIn, error) {
	return nil, nil
}

func (f *fakeCheckinStore) ListRecentByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]CheckIn, error) {
	return f.created, nil
}

func (f *fakeCheckinStore) HasVisitOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error) {
	return f.visitExists, nil
}

func (f *fakeCheckinStore) EntranceConsumedOnDate(ctx context.Context, userID, locationID uuid.UUID, visitDate time.Time) (bool, error) {
	return f.entranceConsumed, nil
}

func (f *fakeCheckinStore) CreateActiveCheckIn(
	ctx context.Context,
	record CheckIn,
	consumeEntrance bool,
	userID uuid.UUID,
	decrement func(context.Context, *gorm.DB, uuid.UUID) error,
) (CheckIn, error) {
	if consumeEntrance {
		if err := decrement(ctx, nil, userID); err != nil {
			return CheckIn{}, err
		}
	}
	if record.ID == uuid.Nil {
		record.ID = uuid.New()
	}
	f.created = append(f.created, record)
	return record, nil
}

func (f *fakeCheckinStore) CheckOut(ctx context.Context, id, userID uuid.UUID, at time.Time, status Status) (CheckIn, error) {
	return f.checkOut, nil
}

func (f *fakeCheckinStore) ListActiveForOwner(ctx context.Context, ownerID uuid.UUID, locationID *uuid.UUID) ([]activeOwnerRow, error) {
	return f.ownerActive, nil
}

func (f *fakeCheckinStore) ListActiveByUserIDsAtLocations(ctx context.Context, userIDs []uuid.UUID, locationIDs []uuid.UUID) (map[uuid.UUID]CheckIn, error) {
	if f.activeByUser == nil {
		return map[uuid.UUID]CheckIn{}, nil
	}
	return f.activeByUser, nil
}

type fakeLocationModelReader struct {
	loc locations.Location
	err error
}

func (f *fakeLocationModelReader) GetLocationModel(ctx context.Context, id string) (locations.Location, error) {
	if f.err != nil {
		return locations.Location{}, f.err
	}
	return f.loc, nil
}

type fakeSubscriptionReader struct {
	sub subscriptions.UserSubscription
	err error
}

func (f *fakeSubscriptionReader) GetActiveByUserID(ctx context.Context, userID uuid.UUID) (subscriptions.UserSubscription, error) {
	if f.err != nil {
		return subscriptions.UserSubscription{}, f.err
	}
	return f.sub, nil
}

type fakeEntranceStore struct {
	called bool
	err    error
}

func (f *fakeEntranceStore) DecrementEntrancesRemaining(ctx context.Context, tx *gorm.DB, userID uuid.UUID) error {
	f.called = true
	return f.err
}

func weekdayLocation() locations.Location {
	return locations.Location{
		ID:           uuid.New(),
		Name:         "Office A",
		Timezone:     "Europe/Bucharest",
		WeekdayOpen:  "00:00",
		WeekdayClose: "23:59",
	}
}

func TestCheckInMonthlyRejectsSecondVisitSameDay(t *testing.T) {
	loc := weekdayLocation()
	uid := uuid.New()
	svc := NewService(
		&fakeCheckinStore{visitExists: true},
		&fakeLocationModelReader{loc: loc},
		&fakeSubscriptionReader{sub: subscriptions.UserSubscription{PlanType: subscriptions.PlanMonthly}},
		&fakeEntranceStore{},
		nil,
		nil,
		Config{},
	)

	_, err := svc.CheckIn(context.Background(), auth.Principal{UserID: uid}, loc.ID.String(), CreateCheckInRequest{})
	if err != ErrAlreadyVisitedToday {
		t.Fatalf("expected ErrAlreadyVisitedToday, got %v", err)
	}
}

func TestCheckInRejectsActiveElsewhere(t *testing.T) {
	locA := weekdayLocation()
	locB := locA
	locB.ID = uuid.New()
	locB.Name = "Office B"

	uid := uuid.New()
	svc := NewService(
		&fakeCheckinStore{
			active:        &CheckIn{LocationID: locA.ID},
			activeLocName: locA.Name,
		},
		&fakeLocationModelReader{loc: locB},
		&fakeSubscriptionReader{sub: subscriptions.UserSubscription{PlanType: subscriptions.PlanMonthly}},
		&fakeEntranceStore{},
		nil,
		nil,
		Config{},
	)

	_, err := svc.CheckIn(context.Background(), auth.Principal{UserID: uid}, locB.ID.String(), CreateCheckInRequest{})
	if !errorsIsAlreadyElsewhere(err) {
		t.Fatalf("expected elsewhere error, got %v", err)
	}
}

func errorsIsAlreadyElsewhere(err error) bool {
	var elsewhere AlreadyCheckedInElsewhereError
	return errors.As(err, &elsewhere)
}

func TestCheckInEntrances10DecrementsFirstVisit(t *testing.T) {
	loc := weekdayLocation()
	uid := uuid.New()
	remaining := 3
	entranceStore := &fakeEntranceStore{}
	svc := NewService(
		&fakeCheckinStore{},
		&fakeLocationModelReader{loc: loc},
		&fakeSubscriptionReader{sub: subscriptions.UserSubscription{
			PlanType:           subscriptions.PlanEntrances10,
			EntrancesRemaining: &remaining,
		}},
		entranceStore,
		nil,
		nil,
		Config{},
	)

	resp, err := svc.CheckIn(context.Background(), auth.Principal{UserID: uid}, loc.ID.String(), CreateCheckInRequest{})
	if err != nil {
		t.Fatalf("check in: %v", err)
	}
	if !entranceStore.called {
		t.Fatal("expected entrance decrement")
	}
	if !resp.EntranceConsumed {
		t.Fatal("expected entrance consumed on response")
	}
}

func TestCheckInEntrances10ReentryDoesNotDecrement(t *testing.T) {
	loc := weekdayLocation()
	uid := uuid.New()
	remaining := 3
	entranceStore := &fakeEntranceStore{}
	svc := NewService(
		&fakeCheckinStore{entranceConsumed: true},
		&fakeLocationModelReader{loc: loc},
		&fakeSubscriptionReader{sub: subscriptions.UserSubscription{
			PlanType:           subscriptions.PlanEntrances10,
			EntrancesRemaining: &remaining,
		}},
		entranceStore,
		nil,
		nil,
		Config{},
	)

	resp, err := svc.CheckIn(context.Background(), auth.Principal{UserID: uid}, loc.ID.String(), CreateCheckInRequest{})
	if err != nil {
		t.Fatalf("check in: %v", err)
	}
	if entranceStore.called {
		t.Fatal("did not expect entrance decrement on re-entry")
	}
	if resp.EntranceConsumed {
		t.Fatal("expected no entrance consumed on re-entry")
	}
}

func TestCheckInExpiredMonthlyRejected(t *testing.T) {
	loc := weekdayLocation()
	expired := time.Now().UTC().Add(-time.Hour)
	svc := NewService(
		&fakeCheckinStore{},
		&fakeLocationModelReader{loc: loc},
		&fakeSubscriptionReader{sub: subscriptions.UserSubscription{
			PlanType:  subscriptions.PlanMonthly,
			ExpiresAt: &expired,
		}},
		&fakeEntranceStore{},
		nil,
		nil,
		Config{},
	)

	_, err := svc.CheckIn(context.Background(), auth.Principal{UserID: uuid.New()}, loc.ID.String(), CreateCheckInRequest{})
	if err != ErrSubscriptionExpired {
		t.Fatalf("expected ErrSubscriptionExpired, got %v", err)
	}
}