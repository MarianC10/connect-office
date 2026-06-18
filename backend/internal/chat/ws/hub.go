package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/MarianC10/connect-office/backend/internal/chat"
	"github.com/MarianC10/connect-office/backend/internal/friends"
	"github.com/coder/websocket"
	"github.com/google/uuid"
)

type Hub struct {
	mu    sync.RWMutex
	conns map[uuid.UUID]map[*websocket.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{
		conns: make(map[uuid.UUID]map[*websocket.Conn]struct{}),
	}
}

func (h *Hub) Register(userID uuid.UUID, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[userID] == nil {
		h.conns[userID] = make(map[*websocket.Conn]struct{})
	}
	h.conns[userID][conn] = struct{}{}
}

func (h *Hub) Unregister(userID uuid.UUID, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.conns[userID]
	if set == nil {
		return
	}
	delete(set, conn)
	if len(set) == 0 {
		delete(h.conns, userID)
	}
}

func (h *Hub) CloseAll() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for userID, set := range h.conns {
		for conn := range set {
			_ = conn.Close(websocket.StatusGoingAway, "server shutdown")
			delete(set, conn)
		}
		delete(h.conns, userID)
	}
}

func (h *Hub) sendToUser(userID uuid.UUID, payload []byte) {
	h.mu.RLock()
	set := h.conns[userID]
	conns := make([]*websocket.Conn, 0, len(set))
	for conn := range set {
		conns = append(conns, conn)
	}
	h.mu.RUnlock()

	for _, conn := range conns {
		ctx, cancel := context.WithTimeout(context.Background(), writeTimeout)
		err := conn.Write(ctx, websocket.MessageText, payload)
		cancel()
		if err != nil {
			log.Printf("ws write to %s: %v", userID, err)
		}
	}
}

func (h *Hub) BroadcastMessage(conversationID uuid.UUID, msg chat.MessageResponse, recipientIDs ...uuid.UUID) {
	payload, err := json.Marshal(map[string]any{
		"type":              "message.new",
		"conversation_id":   conversationID.String(),
		"message":           msg,
	})
	if err != nil {
		log.Printf("ws marshal message.new: %v", err)
		return
	}
	for _, id := range recipientIDs {
		h.sendToUser(id, payload)
	}
}

func (h *Hub) NotifyFriendRequestNew(userID uuid.UUID, request friends.FriendRequestResponse) {
	h.broadcastEvent(userID, "friend_request.new", map[string]any{"request": request})
}

func (h *Hub) NotifyFriendRequestAccepted(userID uuid.UUID, friend friends.FriendResponse) {
	h.broadcastEvent(userID, "friend_request.accepted", map[string]any{"friend": friend})
}

func (h *Hub) broadcastEvent(userID uuid.UUID, eventType string, fields map[string]any) {
	fields["type"] = eventType
	payload, err := json.Marshal(fields)
	if err != nil {
		log.Printf("ws marshal %s: %v", eventType, err)
		return
	}
	h.sendToUser(userID, payload)
}
