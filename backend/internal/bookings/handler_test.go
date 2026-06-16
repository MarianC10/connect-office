package bookings

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type handlerFakeStore struct {
	count int
}

func (h *handlerFakeStore) Create(ctx context.Context, b Booking) (Booking, error) {
	b.ID = uuid.New()
	b.CreatedAt = time.Now().UTC()
	return b, nil
}

func (h *handlerFakeStore) ListConfirmedByUser(ctx context.Context, userID uuid.UUID) ([]Booking, error) {
	return []Booking{}, nil
}

func (h *handlerFakeStore) GetByID(ctx context.Context, id uuid.UUID) (Booking, error) {
	return Booking{}, gorm.ErrRecordNotFound
}

func (h *handlerFakeStore) Cancel(ctx context.Context, id uuid.UUID) error {
	return gorm.ErrRecordNotFound
}

func (h *handlerFakeStore) CountConfirmedByLocationDate(ctx context.Context, locationID uuid.UUID, date time.Time) (int, error) {
	return h.count, nil
}

func (h *handlerFakeStore) HasConfirmedForUserOnDate(ctx context.Context, userID uuid.UUID, date time.Time) (bool, error) {
	return false, nil
}

func TestHandler_CreateBooking(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())

	svc := NewService(
		&handlerFakeStore{},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Test", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	body, _ := json.Marshal(CreateBookingRequest{LocationID: locID.String(), BookingDate: today})
	req := httptest.NewRequest(http.MethodPost, "/bookings", bytes.NewReader(body))
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: uid}))
	rec := httptest.NewRecorder()

	NewBookingsHandler(svc)(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}

	var resp BookingResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.BookingDate != today {
		t.Fatalf("%+v", resp)
	}
}

func TestHandler_AvailabilityJSON(t *testing.T) {
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())

	svc := NewService(
		&handlerFakeStore{count: 40},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Capacity: 40}},
		&fakeUserProvisioner{},
	)

	req := httptest.NewRequest(http.MethodGet, "/locations/"+locID.String()+"/availability?date="+today, nil)
	rec := httptest.NewRecorder()

	NewLocationAvailabilityHandler(svc)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}

	var avail AvailabilityResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &avail); err != nil {
		t.Fatal(err)
	}
	if avail.Status != "busy" {
		t.Fatalf("%+v", avail)
	}
}

func TestHandler_CreateBooking_conflictWhenFull(t *testing.T) {
	uid := uuid.New()
	locID := uuid.New()
	today := formatBookingDate(todayInBucharest())

	svc := NewService(
		&handlerFakeStore{count: 60},
		&fakeLocationReader{loc: locations.LocationResponse{ID: locID.String(), Name: "Test", Capacity: 40}},
		&fakeUserProvisioner{},
	)

	body, _ := json.Marshal(CreateBookingRequest{LocationID: locID.String(), BookingDate: today})
	req := httptest.NewRequest(http.MethodPost, "/bookings", bytes.NewReader(body))
	req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{UserID: uid}))
	rec := httptest.NewRecorder()

	NewBookingsHandler(svc)(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}
