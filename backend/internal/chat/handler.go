package chat

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
)

func NewConversationsHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			listConversations(w, r, svc)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func NewConversationByIDHandler(svc *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/conversations/")
		path = strings.Trim(path, "/")
		if path == "" || strings.Contains(path, "//") {
			http.NotFound(w, r)
			return
		}

		parts := strings.Split(path, "/")
		switch {
		case len(parts) == 2 && parts[0] == "with" && r.Method == http.MethodGet:
			getConversationWithFriend(w, r, svc, parts[1])
		case len(parts) == 2 && parts[1] == "messages":
			handleMessages(w, r, svc, parts[0])
		default:
			http.NotFound(w, r)
		}
	}
}

func listConversations(w http.ResponseWriter, r *http.Request, svc *Service) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	items, err := svc.ListConversations(r.Context(), p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ConversationResponse{}
	}
	writeJSON(w, http.StatusOK, items)
}

func getConversationWithFriend(w http.ResponseWriter, r *http.Request, svc *Service, friendID string) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	item, err := svc.GetConversationWithFriend(r.Context(), p, friendID)
	if err != nil {
		writeChatError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func handleMessages(w http.ResponseWriter, r *http.Request, svc *Service, conversationID string) {
	switch r.Method {
	case http.MethodGet:
		listMessages(w, r, svc, conversationID)
	case http.MethodPost:
		sendMessage(w, r, svc, conversationID)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func listMessages(w http.ResponseWriter, r *http.Request, svc *Service, conversationID string) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	before := r.URL.Query().Get("before")
	limit := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = n
	}
	items, err := svc.ListMessages(r.Context(), p, conversationID, before, limit)
	if err != nil {
		writeChatError(w, err)
		return
	}
	if items == nil {
		items = []MessageResponse{}
	}
	writeJSON(w, http.StatusOK, items)
}

func sendMessage(w http.ResponseWriter, r *http.Request, svc *Service, conversationID string) {
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
	var req SendMessageBody
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	msg, err := svc.SendMessage(r.Context(), p, conversationID, req.Body)
	if err != nil {
		writeChatError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, msg)
}

func writeChatError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrConversationNotFound), errors.Is(err, ErrFriendNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrNotParticipant), errors.Is(err, ErrNotFriends):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, ErrInvalidMessage):
		http.Error(w, err.Error(), http.StatusBadRequest)
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
