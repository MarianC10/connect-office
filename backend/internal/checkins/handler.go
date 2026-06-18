package checkins

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func withCheckinsEnabled(svc *Service, fn func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return fn
}

func NewCheckInHandler(svc *Service) http.HandlerFunc {
	return withCheckinsEnabled(svc, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/locations/")
		path = strings.TrimSuffix(path, "/check-in")
		path = strings.Trim(path, "/")
		if path == "" || strings.Contains(path, "/") {
			http.Error(w, "invalid location id", http.StatusBadRequest)
			return
		}

		var req CreateCheckInRequest
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if len(body) > 0 {
			if err := json.Unmarshal(body, &req); err != nil {
				http.Error(w, "invalid json body", http.StatusBadRequest)
				return
			}
		}

		resp, err := svc.CheckIn(r.Context(), p, path, req)
		if err != nil {
			writeCheckInError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	})
}

func NewCheckOutHandler(svc *Service) http.HandlerFunc {
	return withCheckinsEnabled(svc, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := strings.TrimPrefix(r.URL.Path, "/check-ins/")
		id = strings.TrimSuffix(id, "/check-out")
		id = strings.Trim(id, "/")
		if id == "" || strings.Contains(id, "/") {
			http.Error(w, "invalid check-in id", http.StatusBadRequest)
			return
		}

		resp, err := svc.CheckOut(r.Context(), p, id)
		if err != nil {
			writeCheckInError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func NewMyCheckInsHandler(svc *Service) http.HandlerFunc {
	return withCheckinsEnabled(svc, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		resp, err := svc.GetMine(r.Context(), p)
		if err != nil {
			writeCheckInError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func NewActiveCheckInsHandler(svc *Service) http.HandlerFunc {
	return withCheckinsEnabled(svc, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/locations/")
		path = strings.TrimSuffix(path, "/check-ins/active")
		path = strings.Trim(path, "/")
		if path == "" || strings.Contains(path, "/") {
			http.Error(w, "invalid location id", http.StatusBadRequest)
			return
		}

		items, err := svc.ListActiveAtLocation(r.Context(), path)
		if err != nil {
			writeCheckInError(w, err)
			return
		}
		if items == nil {
			items = []ActiveUserResponse{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

func NewOwnerPresenceHandler(svc *Service, requireOwner func(http.ResponseWriter, *http.Request) (auth.Principal, bool)) http.HandlerFunc {
	return withCheckinsEnabled(svc, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := requireOwner(w, r)
		if !ok {
			return
		}

		resp, err := svc.OwnerPresence(r.Context(), p.UserID, r.URL.Query().Get("date"), r.URL.Query().Get("location_id"))
		if err != nil {
			writeCheckInError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func writeCheckInError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrLocationNotFound), errors.Is(err, ErrCheckInNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrNoActiveSubscription), errors.Is(err, ErrSubscriptionExpired),
		errors.Is(err, ErrNoEntrancesRemaining), errors.Is(err, ErrOutsideWorkingHours):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrAlreadyCheckedIn), errors.Is(err, ErrAlreadyCheckedInElsewhere),
		errors.Is(err, ErrAlreadyVisitedToday):
		var elsewhere AlreadyCheckedInElsewhereError
		if errors.As(err, &elsewhere) {
			http.Error(w, elsewhere.Error(), http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		if strings.Contains(err.Error(), "invalid") {
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
