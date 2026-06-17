package friends

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func NewRequestsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			createRequest(w, r, svc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewInboxHandler(svc *Service) http.HandlerFunc {
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
		items, err := svc.ListInbox(r.Context(), p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []FriendRequestResponse{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func NewRequestByIDHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/friends/requests/")
		path = strings.Trim(path, "/")
		if path == "" || strings.Contains(path, "/") {
			http.NotFound(w, r)
			return
		}

		parts := strings.Split(path, "/")
		requestID := parts[0]
		action := ""
		if len(parts) == 2 {
			action = parts[1]
		}

		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		switch {
		case action == "accept" && r.Method == http.MethodPost:
			if err := svc.AcceptRequest(r.Context(), p, requestID); err != nil {
				writeFriendError(w, err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		case action == "decline" && r.Method == http.MethodPost:
			if err := svc.DeclineRequest(r.Context(), p, requestID); err != nil {
				writeFriendError(w, err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(w, r)
		}
	}
}

func NewFriendsHandler(svc *Service) http.HandlerFunc {
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
		items, err := svc.ListFriends(r.Context(), p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []FriendResponse{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func createRequest(w http.ResponseWriter, r *http.Request, svc *Service) {
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
	var req CreateRequestBody
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}

	item, err := svc.CreateRequest(r.Context(), p, req)
	if err != nil {
		writeFriendError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func writeFriendError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUserNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrInvalidRequest), errors.Is(err, ErrCannotFriendSelf):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrAlreadyFriends), errors.Is(err, ErrPendingRequestExists):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, ErrRequestNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	default:
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
