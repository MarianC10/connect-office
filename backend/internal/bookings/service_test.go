package bookings

import (
	"context"
	"testing"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type fakeBookingStore struct {
	bookings      []Booking
	countByLoc    map[string]int
	hasUserOnDate bool
	createErr     error
}

func (f *fakeBookingStore) Create(ctx context.Context, b Booking) (Booking, error) {
	if f.createErr != nil {
		return Booking{}, f.createErr
	}
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	b.CreatedAt = time.Now().UTC()
	f.bookings = append(f.bookings, b)
	return b, nil
}

func (f *fakeBookingStore) ListConfirmedByUser(ctx context.Context, userID uuid.UUID) ([]Booking, error) {
	var out []Booking
	for _, b := range f.bookings {
		if b.UserID == userID && b.Status == BookingStatusConfirmed {
			out = append(out, b)
		}
	}
	return out, nil
}

func (f *fakeBookingStore) GetByID(ctx context.Context, id uuid.UUID) (Booking, error) {
	for _, b := range f.bookings {
		if b.ID == id {
			return b, nil
		}
	}
	return Booking{}, gorm.ErrRecordNotFound
}

func (f *fakeBookingStore) Cancel(ctx context.Context, id uuid.UUID) error {
	for i, b := range f.bookings {
		if b.ID == id && b.Status == BookingStatusConfirmed {
			f.bookings[i].Status = BookingStatusCancelled
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (f *fakeBookingStore) CountConfirmedByLocationDate(ctx context.Context, locationID uuid.UUID, date time.Time) (int, error) {
	key := locationID.String() + formatBookingDate(date)
	if f.countByLoc != nil {
		return f.countByLoc[key], nil
	}
	return 0, nil
}

func (f *fakeBookingStore) HasConfirmedForUserOnDate(ctx context.Context, userID uuid.UUID, date time.Time) (bool, error) {
	return f.hasUserOnDate, nil
}

type fakeLocationReader struct {
	loc locations.LocationResponse
	err error
}

func (f *fakeLocationReader) GetLocationByID(ctx context.Context, id string) (locations.LocationResponse, error) {
	if f.err != nil {
		return locations.LocationResponse{}, f.err
	}
	return f.loc, nil
}

type fakeUserProvisioner struct {
	err error
}

func (f *fakeUserProvisioner) UpsertFromPrincipal(ctx context.Context, p auth.Principal) (users.User, error) {
	if f.err != nil {
		return users.User{}, f.err
	}
	return users.User{ID: p.UserID}, nil
}

func TestService_Create_rejectsOutOfRangeDate(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	svc := NewService(
		&fakeBookingStore{},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Test", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	yesterday := formatBookingDate(todayInBucharest().AddDate(0, 0, -1))
	_, err := svc.Create(context.Background(), auth.Principal{UserID: uid}, CreateBookingRequest{
		LocationID:  locID.String(),
		BookingDate: yesterday,
	})
	if err != ErrBookingDateOutOfRange {
		t.Fatalf("got %v, want ErrBookingDateOutOfRange", err)
	}
}

func TestService_Create_rejectsDuplicateDay(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())
	svc := NewService(
		&fakeBookingStore{hasUserOnDate: true},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Test", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	_, err := svc.Create(context.Background(), auth.Principal{UserID: uid}, CreateBookingRequest{
		LocationID:  locID.String(),
		BookingDate: today,
	})
	if err != ErrBookingAlreadyExists {
		t.Fatalf("got %v, want ErrBookingAlreadyExists", err)
	}
}

func TestService_Create_rejectsLocationFull(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())
	svc := NewService(
		&fakeBookingStore{countByLoc: map[string]int{locID.String() + today: 60}},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Test", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	_, err := svc.Create(context.Background(), auth.Principal{UserID: uid}, CreateBookingRequest{
		LocationID:  locID.String(),
		BookingDate: today,
	})
	if err != ErrLocationFull {
		t.Fatalf("got %v, want ErrLocationFull", err)
	}
}

func TestService_Create_allowsBusyButNotFull(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())
	store := &fakeBookingStore{countByLoc: map[string]int{locID.String() + today: 40}}
	svc := NewService(
		store,
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Cluj", City: "Cluj-Napoca", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	resp, err := svc.Create(context.Background(), auth.Principal{UserID: uid}, CreateBookingRequest{
		LocationID:  locID.String(),
		BookingDate: today,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.BookingDate != today || resp.Location.Name != "Cluj" {
		t.Fatalf("%+v", resp)
	}
}

func TestService_Availability(t *testing.T) {
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())
	svc := NewService(
		&fakeBookingStore{countByLoc: map[string]int{locID.String() + today: 42}},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Capacity: 40}},
		&fakeUserProvisioner{},
	)

	avail, err := svc.Availability(context.Background(), locID.String(), today)
	if err != nil {
		t.Fatal(err)
	}
	if avail.Status != "busy" || avail.BookedCount != 42 || avail.Capacity != 40 {
		t.Fatalf("%+v", avail)
	}
}

func TestService_Cancel_ownerOnly(t *testing.T) {
	uid := uuid.New()
	other := uuid.New()
	bookingID := uuid.New()
	store := &fakeBookingStore{
		bookings: []Booking{{
			ID:     bookingID,
			UserID: uid,
			Status: BookingStatusConfirmed,
		}},
	}
	svc := NewService(store, &fakeLocationReader{}, &fakeUserProvisioner{})

	if err := svc.Cancel(context.Background(), auth.Principal{UserID: other}, bookingID.String()); err != ErrBookingNotFound {
		t.Fatalf("got %v, want ErrBookingNotFound", err)
	}
	if err := svc.Cancel(context.Background(), auth.Principal{UserID: uid}, bookingID.String()); err != nil {
		t.Fatal(err)
	}
	if store.bookings[0].Status != BookingStatusCancelled {
		t.Fatal("expected cancelled status")
	}
}
