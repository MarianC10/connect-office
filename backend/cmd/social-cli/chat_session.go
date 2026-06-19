package main

import (
	"bufio"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

func runChatSession(c *apiClient, token, email string, historyLimit int) error {
	profile, err := c.resolveEmail(email)
	if err != nil {
		return err
	}

	conv, err := c.conversationWithFriend(profile.ID)
	if err != nil {
		return err
	}

	me, err := c.getMe()
	if err != nil {
		return err
	}

	messages, err := c.listMessages(conv.ID, historyLimit)
	if err != nil {
		return err
	}

	fmt.Printf("Chat with %s (%s)\n", profile.DisplayName, email)
	printHistory(messages, me.ID, profile.DisplayName)

	var printMu sync.Mutex
	safePrint := func(label, iso, body string) {
		printMu.Lock()
		defer printMu.Unlock()
		printMessageLine(label, iso, body)
	}

	ws, err := connectWS(wsURL(c.baseURL, token), conv.ID, func(msg chatMessage) {
		if msg.SenderID == me.ID {
			return
		}
		safePrint(profile.DisplayName, msg.CreatedAt, msg.Body)
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: websocket connect failed (%v), using REST fallback for send\n", err)
	} else {
		defer ws.close()
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	inputDone := make(chan struct{})
	go func() {
		defer close(inputDone)
		scanner := bufio.NewScanner(os.Stdin)
		fmt.Print("> ")
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				fmt.Print("> ")
				continue
			}
			if strings.HasPrefix(line, "/") {
				if handleChatCommand(c, ws, conv.ID, me.ID, profile.DisplayName, line, historyLimit, safePrint) {
					return
				}
				fmt.Print("> ")
				continue
			}

			body, err := normalizeMessageBody(line)
			if err != nil {
				printErr(err)
				fmt.Print("> ")
				continue
			}

			sent := false
			if ws != nil && ws.connected() {
				if err := ws.send(conv.ID, body); err != nil {
					fmt.Fprintf(os.Stderr, "ws send failed: %v\n", err)
				} else {
					sent = true
					now := timeNowRFC3339()
					safePrint("You", now, body)
				}
			}
			if !sent {
				msg, err := c.sendMessage(conv.ID, body)
				if err != nil {
					printErr(err)
				} else {
					if ws != nil {
						ws.markSeen(msg.ID)
					}
					safePrint("You", msg.CreatedAt, msg.Body)
				}
			}
			fmt.Print("> ")
		}
	}()

	select {
	case <-sigCh:
		fmt.Println()
		return nil
	case <-inputDone:
		return nil
	}
}

func handleChatCommand(c *apiClient, ws *wsClient, convID, myUserID, peerName, line string, historyLimit int, safePrint func(string, string, string)) bool {
	parts := strings.Fields(line)
	cmd := parts[0]
	switch cmd {
	case "/quit", "/exit":
		return true
	case "/history":
		limit := historyLimit
		if len(parts) >= 2 {
			var n int
			if _, err := fmt.Sscanf(parts[1], "%d", &n); err == nil && n > 0 {
				limit = n
			}
		}
		messages, err := c.listMessages(convID, limit)
		if err != nil {
			printErr(err)
			return false
		}
		printHistory(messages, myUserID, peerName)
		return false
	default:
		fmt.Fprintf(os.Stderr, "unknown command %s (try /quit, /history)\n", cmd)
	}
	return false
}

func timeNowRFC3339() string {
	return timeNow().UTC().Format(timeRFC3339)
}

// Overridable in tests.
var timeNow = func() time.Time { return time.Now() }

const timeRFC3339 = "2006-01-02T15:04:05Z07:00"
