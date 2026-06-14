package bookings

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func NewBookingsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			createBooking(w, r, svc)
		case http.MethodGet:
			listBookings(w, r, svc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewBookingByIDHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := strings.TrimPrefix(r.URL.Path, "/bookings/")
		if id == "" || strings.Contains(id, "/") {
			http.Error(w, "invalid booking id", http.StatusBadRequest)
			return
		}

		if err := svc.Cancel(r.Context(), p, id); err != nil {
			writeBookingError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func NewLocationAvailabilityHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/locations/")
		if !strings.HasSuffix(path, "/availability") {
			http.NotFound(w, r)
			return
		}
		locationID := strings.TrimSuffix(path, "/availability")
		locationID = strings.TrimSuffix(locationID, "/")
		if locationID == "" || strings.Contains(locationID, "/") {
			http.Error(w, "invalid location id", http.StatusBadRequest)
			return
		}

		date := r.URL.Query().Get("date")
		if date == "" {
			http.Error(w, "date query parameter is required", http.StatusBadRequest)
			return
		}

		avail, err := svc.Availability(r.Context(), locationID, date)
		if err != nil {
			writeBookingError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, avail)
	}
}

func createBooking(w http.ResponseWriter, r *http.Request, svc *Service) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var req CreateBookingRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if req.LocationID == "" || req.BookingDate == "" {
		http.Error(w, "location_id and booking_date are required", http.StatusBadRequest)
		return
	}

	booking, err := svc.Create(r.Context(), p, req)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, booking)
}

func listBookings(w http.ResponseWriter, r *http.Request, svc *Service) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items, err := svc.List(r.Context(), p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []BookingResponse{}
	}
	writeJSON(w, http.StatusOK, items)
}

func writeBookingError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrBookingDateOutOfRange):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, locations.ErrLocationNotFound), errors.Is(err, ErrBookingNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrBookingAlreadyExists), errors.Is(err, ErrLocationFull):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		if strings.Contains(err.Error(), "invalid booking_date") || strings.Contains(err.Error(), "invalid location_id") {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}
