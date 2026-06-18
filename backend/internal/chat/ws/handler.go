package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/chat"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/coder/websocket"
	"github.com/google/uuid"
)

const (
	writeTimeout = 10 * time.Second
	pingInterval = 30 * time.Second
	maxMessageSize = 16 * 1024
)

type ChatService interface {
	SendMessageFromWS(ctx context.Context, userID uuid.UUID, conversationID uuid.UUID, body string) (chat.MessageResponse, error)
}

func NewHandler(verifier *auth.Verifier, hub *Hub, chatSvc ChatService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := strings.TrimSpace(r.URL.Query().Get("token"))
		if token == "" {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}
		p, err := verifier.Verify(token)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true,
		})
		if err != nil {
			log.Printf("ws accept: %v", err)
			return
		}
		conn.SetReadLimit(maxMessageSize)

		hub.Register(p.UserID, conn)
		defer func() {
			hub.Unregister(p.UserID, conn)
			_ = conn.Close(websocket.StatusNormalClosure, "disconnect")
		}()

		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()

		go pingLoop(ctx, conn)

		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				return
			}
			handleClientMessage(ctx, chatSvc, p.UserID, data)
		}
	}
}

func pingLoop(ctx context.Context, conn *websocket.Conn) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pingCtx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

type clientMessage struct {
	Type           string `json:"type"`
	ConversationID string `json:"conversation_id"`
	Body           string `json:"body"`
}

func handleClientMessage(ctx context.Context, chatSvc ChatService, userID uuid.UUID, data []byte) {
	var msg clientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	if msg.Type != "message.send" {
		return
	}
	convID, err := uuid.Parse(msg.ConversationID)
	if err != nil {
		return
	}
	_, err = chatSvc.SendMessageFromWS(ctx, userID, convID, msg.Body)
	if err != nil {
		log.Printf("ws message.send from %s: %v", userID, err)
	}
}
