package owner

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

const maxMultipartBytes = 6 << 20

func NewAmenitiesHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		items, err := svc.ListAmenities(r.Context(), p)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func NewOwnerLocationsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch r.Method {
		case http.MethodGet:
			items, err := svc.ListLocations(r.Context(), p)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, items)
		case http.MethodPost:
			var req CreateLocationRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			loc, err := svc.CreateLocation(r.Context(), p, req)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, loc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewOwnerLocationByIDHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/owner/locations/")
		path = strings.Trim(path, "/")
		if path == "" || strings.Contains(path, "/") {
			http.NotFound(w, r)
			return
		}

		switch r.Method {
		case http.MethodGet:
			loc, err := svc.GetLocation(r.Context(), p, path)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, loc)
		case http.MethodPatch:
			var req UpdateLocationRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			loc, err := svc.UpdateLocation(r.Context(), p, path, req)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, loc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewOwnerLocationImagesHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// /owner/locations/{id}/images or /owner/locations/{id}/images/{imageId}
		rest := strings.TrimPrefix(r.URL.Path, "/owner/locations/")
		parts := strings.Split(strings.Trim(rest, "/"), "/")
		if len(parts) < 2 || parts[1] != "images" {
			http.NotFound(w, r)
			return
		}
		locationID := parts[0]

		if len(parts) == 2 {
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if err := r.ParseMultipartForm(maxMultipartBytes); err != nil {
				http.Error(w, "invalid multipart form", http.StatusBadRequest)
				return
			}
			file, header, err := r.FormFile("image")
			if err != nil {
				http.Error(w, "image field is required", http.StatusBadRequest)
				return
			}
			defer file.Close()

			peek := make([]byte, 512)
			n, _ := file.Read(peek)
			peek = peek[:n]

			resp, err := svc.UploadImage(r.Context(), p, locationID, file, header.Header.Get("Content-Type"), peek)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, resp)
			return
		}

		if len(parts) == 3 && r.Method == http.MethodDelete {
			imageID := parts[2]
			if err := svc.DeleteImage(r.Context(), p, locationID, imageID); err != nil {
				writeError(w, err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		http.NotFound(w, r)
	}
}

func NewOwnerBookingsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		date := r.URL.Query().Get("date")
		locationID := r.URL.Query().Get("location_id")
		items, err := svc.ListBookings(r.Context(), p, date, locationID)
		if err != nil {
			writeError(w, err)
			return
		}
		if items == nil {
			items = []OwnerBooking{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func NewOwnerRouter(svc *Service) http.HandlerFunc {
	locationsHandler := NewOwnerLocationsHandler(svc)
	locationByIDHandler := NewOwnerLocationByIDHandler(svc)
	imagesHandler := NewOwnerLocationImagesHandler(svc)
	bookingsHandler := NewOwnerBookingsHandler(svc)

	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/owner/locations":
			locationsHandler(w, r)
		case path == "/owner/bookings":
			bookingsHandler(w, r)
		case strings.HasPrefix(path, "/owner/locations/") && strings.Contains(path, "/images"):
			imagesHandler(w, r)
		case strings.HasPrefix(path, "/owner/locations/"):
			locationByIDHandler(w, r)
		default:
			http.NotFound(w, r)
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotOwner), errors.Is(err, ErrForbidden):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, ErrLocationNotFound), errors.Is(err, ErrImageNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrInvalidInput):
		http.Error(w, err.Error(), http.StatusBadRequest)
	default:
		if errors.Is(err, io.EOF) {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
