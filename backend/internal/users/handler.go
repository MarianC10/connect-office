package users

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

func NewMeHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getMe(w, r, svc)
		case http.MethodPatch:
			patchMe(w, r, svc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewAvatarHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p, ok := auth.PrincipalFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if err := r.ParseMultipartForm(maxAvatarBytes); err != nil {
			http.Error(w, "invalid multipart form", http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("avatar")
		if err != nil {
			http.Error(w, "avatar field is required", http.StatusBadRequest)
			return
		}
		defer file.Close()

		peek := make([]byte, 512)
		n, _ := file.Read(peek)
		peek = peek[:n]

		me, err := svc.UploadAvatar(r.Context(), p, file, header.Header.Get("Content-Type"), peek)
		if err != nil {
			writeUserError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, me)
	}
}

func NewUsersHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/users/")
		path = strings.Trim(path, "/")

		switch {
		case path == "search" && r.Method == http.MethodGet:
			searchUsers(w, r, svc)
		case path == "lookup-by-email" && r.Method == http.MethodPost:
			lookupByEmail(w, r, svc)
		case path != "" && !strings.Contains(path, "/") && r.Method == http.MethodGet:
			getUserByID(w, r, svc, path)
		default:
			http.NotFound(w, r)
		}
	}
}

func getMe(w http.ResponseWriter, r *http.Request, svc *Service) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	me, err := svc.Me(r.Context(), p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, me)
}

func patchMe(w http.ResponseWriter, r *http.Request, svc *Service) {
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
	var req UpdateMeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if req.DisplayName == nil && req.IsPublic == nil {
		http.Error(w, "at least one field is required", http.StatusBadRequest)
		return
	}

	me, err := svc.UpdateMe(r.Context(), p, req)
	if err != nil {
		writeUserError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, me)
}

func searchUsers(w http.ResponseWriter, r *http.Request, svc *Service) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	items, err := svc.Search(r.Context(), q)
	if err != nil {
		writeUserError(w, err)
		return
	}
	if items == nil {
		items = []PublicProfileResponse{}
	}
	writeJSON(w, http.StatusOK, items)
}

func lookupByEmail(w http.ResponseWriter, r *http.Request, svc *Service) {
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
	var req LookupByEmailRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}

	profile, err := svc.LookupByEmail(r.Context(), p, email)
	if err != nil {
		writeUserError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func getUserByID(w http.ResponseWriter, r *http.Request, svc *Service, id string) {
	userID, err := uuid.Parse(id)
	if err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}
	profile, err := svc.GetPublicProfile(r.Context(), userID)
	if err != nil {
		writeUserError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func writeUserError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUserNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrInvalidDisplayName), errors.Is(err, ErrSearchQueryTooShort):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, ErrRateLimited):
		http.Error(w, err.Error(), http.StatusTooManyRequests)
	default:
		if strings.Contains(err.Error(), "unsupported image") || strings.Contains(err.Error(), "avatar") {
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
