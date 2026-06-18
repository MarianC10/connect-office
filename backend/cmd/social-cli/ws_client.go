package main

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/coder/websocket"
)

type wsMessageNew struct {
	Type           string      `json:"type"`
	ConversationID string      `json:"conversation_id"`
	Message        chatMessage `json:"message"`
}

type wsClient struct {
	conn             *websocket.Conn
	mu               sync.Mutex
	seen             map[string]struct{}
	onMessage        func(chatMessage)
	conversationID   string
}

func connectWS(wsURL string, conversationID string, onMessage func(chatMessage)) (*wsClient, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		return nil, err
	}

	c := &wsClient{
		conn:           conn,
		seen:           make(map[string]struct{}),
		onMessage:      onMessage,
		conversationID: conversationID,
	}
	go c.readLoop()
	return c, nil
}

func (c *wsClient) readLoop() {
	ctx := context.Background()
	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			return
		}
		var evt wsMessageNew
		if err := json.Unmarshal(data, &evt); err != nil {
			continue
		}
		if evt.Type != "message.new" || evt.ConversationID != c.conversationID {
			continue
		}
		c.mu.Lock()
		if _, ok := c.seen[evt.Message.ID]; ok {
			c.mu.Unlock()
			continue
		}
		c.seen[evt.Message.ID] = struct{}{}
		cb := c.onMessage
		c.mu.Unlock()
		if cb != nil {
			cb(evt.Message)
		}
	}
}

func (c *wsClient) markSeen(id string) {
	c.mu.Lock()
	c.seen[id] = struct{}{}
	c.mu.Unlock()
}

func (c *wsClient) send(conversationID, body string) error {
	payload, err := json.Marshal(map[string]string{
		"type":              "message.send",
		"conversation_id": conversationID,
		"body":              body,
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return c.conn.Write(ctx, websocket.MessageText, payload)
}

func (c *wsClient) close() {
	if c.conn != nil {
		_ = c.conn.Close(websocket.StatusNormalClosure, "done")
	}
}

func (c *wsClient) connected() bool {
	return c.conn != nil
}
