package social

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func NewVisibleBookingsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/locations/")
		if !strings.HasSuffix(path, "/bookings/visible") {
			http.NotFound(w, r)
			return
		}
		locationID := strings.TrimSuffix(path, "/bookings/visible")
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

		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		items, err := svc.ListVisibleBookings(r.Context(), p, locationID, date)
		if err != nil {
			writeVisibleError(w, err)
			return
		}
		if items == nil {
			items = []VisibleBookingResponse{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func writeVisibleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, bookings.ErrBookingDateOutOfRange):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, locations.ErrLocationNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
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
