package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"unicode/utf8"
)

const maxMessageRunes = 2000

type apiClient struct {
	baseURL string
	token   string
	http    *http.Client
}

func newAPIClient(baseURL, token string) *apiClient {
	return &apiClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		http:    &http.Client{},
	}
}

func apiBaseFromEnv() string {
	if v := strings.TrimSpace(os.Getenv("SOCIAL_CLI_API_BASE_URL")); v != "" {
		return v
	}
	return "http://localhost:8080"
}

func (c *apiClient) do(method, path string, body any) ([]byte, int, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	if res.StatusCode >= 400 {
		msg := strings.TrimSpace(string(data))
		if msg == "" {
			msg = fmt.Sprintf("HTTP %d", res.StatusCode)
		}
		return nil, res.StatusCode, fmt.Errorf("%s", msg)
	}
	return data, res.StatusCode, nil
}

type meProfile struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	IsPublic    bool   `json:"is_public"`
	AvatarURL   string `json:"avatar_url"`
}

type publicProfile struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsPublic    bool   `json:"is_public"`
	AvatarURL   string `json:"avatar_url"`
}

type friendRequest struct {
	ID          string `json:"id"`
	FromUserID  string `json:"from_user_id"`
	FromEmail   string `json:"from_email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	CreatedAt   string `json:"created_at"`
}

type outgoingFriendRequest struct {
	ID          string `json:"id"`
	ToUserID    string `json:"to_user_id"`
	ToEmail     string `json:"to_email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	CreatedAt   string `json:"created_at"`
}

type friend struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsPublic    bool   `json:"is_public"`
	AvatarURL   string `json:"avatar_url"`
}

type chatMessage struct {
	ID        string `json:"id"`
	SenderID  string `json:"sender_id"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}

type lastMessagePreview struct {
	ID        string `json:"id"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}

type conversation struct {
	ID          string              `json:"id"`
	Friend      publicProfile       `json:"friend"`
	LastMessage *lastMessagePreview `json:"last_message"`
}

func (c *apiClient) getMe() (meProfile, error) {
	data, _, err := c.do(http.MethodGet, "/me", nil)
	if err != nil {
		return meProfile{}, err
	}
	var out meProfile
	return out, json.Unmarshal(data, &out)
}

func (c *apiClient) patchMe(displayName *string, isPublic *bool) (meProfile, error) {
	body := map[string]any{}
	if displayName != nil {
		body["display_name"] = *displayName
	}
	if isPublic != nil {
		body["is_public"] = *isPublic
	}
	data, _, err := c.do(http.MethodPatch, "/me", body)
	if err != nil {
		return meProfile{}, err
	}
	var out meProfile
	return out, json.Unmarshal(data, &out)
}

func (c *apiClient) resolveEmail(email string) (publicProfile, error) {
	data, _, err := c.do(http.MethodPost, "/users/lookup-by-email", map[string]string{
		"email": strings.TrimSpace(email),
	})
	if err != nil {
		return publicProfile{}, err
	}
	var out publicProfile
	return out, json.Unmarshal(data, &out)
}

func (c *apiClient) searchUsers(q string) ([]publicProfile, error) {
	data, _, err := c.do(http.MethodGet, "/users/search?q="+url.QueryEscape(q), nil)
	if err != nil {
		return nil, err
	}
	var out []publicProfile
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) listFriends() ([]friend, error) {
	data, _, err := c.do(http.MethodGet, "/friends", nil)
	if err != nil {
		return nil, err
	}
	var out []friend
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) listInbox() ([]friendRequest, error) {
	data, _, err := c.do(http.MethodGet, "/friends/requests/inbox", nil)
	if err != nil {
		return nil, err
	}
	var out []friendRequest
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) listOutgoing() ([]outgoingFriendRequest, error) {
	data, _, err := c.do(http.MethodGet, "/friends/requests/outgoing", nil)
	if err != nil {
		return nil, err
	}
	var out []outgoingFriendRequest
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) sendFriendRequest(email string) error {
	_, _, err := c.do(http.MethodPost, "/friends/requests", map[string]string{
		"email": strings.TrimSpace(email),
	})
	return err
}

func (c *apiClient) acceptRequest(requestID string) error {
	_, _, err := c.do(http.MethodPost, "/friends/requests/"+requestID+"/accept", nil)
	return err
}

func (c *apiClient) declineRequest(requestID string) error {
	_, _, err := c.do(http.MethodPost, "/friends/requests/"+requestID+"/decline", nil)
	return err
}

func (c *apiClient) cancelRequest(requestID string) error {
	_, _, err := c.do(http.MethodPost, "/friends/requests/"+requestID+"/cancel", nil)
	return err
}

func (c *apiClient) unfriend(userID string) error {
	_, _, err := c.do(http.MethodDelete, "/friends/user/"+url.PathEscape(userID), nil)
	return err
}

func (c *apiClient) findInboxRequestFromEmail(emailOrName string) (friendRequest, error) {
	query := strings.TrimSpace(emailOrName)
	inbox, err := c.listInbox()
	if err != nil {
		return friendRequest{}, err
	}
	for _, req := range inbox {
		if req.FromEmail != "" && strings.EqualFold(strings.TrimSpace(req.FromEmail), query) {
			return req, nil
		}
	}
	for _, req := range inbox {
		if strings.EqualFold(strings.TrimSpace(req.DisplayName), query) {
			return req, nil
		}
	}

	profile, err := c.resolveEmail(query)
	if err != nil {
		return friendRequest{}, fmt.Errorf("no pending request from %q (use exact email from inbox, or display name)", query)
	}
	for _, req := range inbox {
		if req.FromUserID == profile.ID {
			return req, nil
		}
	}
	return friendRequest{}, fmt.Errorf("no pending request from %q", query)
}

func (c *apiClient) findOutgoingRequestToEmail(emailOrName string) (outgoingFriendRequest, error) {
	query := strings.TrimSpace(emailOrName)
	outgoing, err := c.listOutgoing()
	if err != nil {
		return outgoingFriendRequest{}, err
	}
	for _, req := range outgoing {
		if req.ToEmail != "" && strings.EqualFold(strings.TrimSpace(req.ToEmail), query) {
			return req, nil
		}
	}
	for _, req := range outgoing {
		if strings.EqualFold(strings.TrimSpace(req.DisplayName), query) {
			return req, nil
		}
	}

	profile, err := c.resolveEmail(query)
	if err != nil {
		return outgoingFriendRequest{}, fmt.Errorf("no pending outgoing request to %q", query)
	}
	for _, req := range outgoing {
		if req.ToUserID == profile.ID {
			return req, nil
		}
	}
	return outgoingFriendRequest{}, fmt.Errorf("no pending outgoing request to %q", query)
}

func (c *apiClient) isFriend(userID string) (bool, error) {
	friends, err := c.listFriends()
	if err != nil {
		return false, err
	}
	for _, f := range friends {
		if f.ID == userID {
			return true, nil
		}
	}
	return false, nil
}

func (c *apiClient) listConversations() ([]conversation, error) {
	data, _, err := c.do(http.MethodGet, "/conversations", nil)
	if err != nil {
		return nil, err
	}
	var out []conversation
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) conversationWithFriend(friendUserID string) (conversation, error) {
	data, _, err := c.do(http.MethodGet, "/conversations/with/"+url.PathEscape(friendUserID), nil)
	if err != nil {
		return conversation{}, err
	}
	var out conversation
	return out, json.Unmarshal(data, &out)
}

func (c *apiClient) listMessages(conversationID string, limit int) ([]chatMessage, error) {
	path := fmt.Sprintf("/conversations/%s/messages?limit=%d", url.PathEscape(conversationID), limit)
	data, _, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	var out []chatMessage
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *apiClient) sendMessage(conversationID, body string) (chatMessage, error) {
	normalized, err := normalizeMessageBody(body)
	if err != nil {
		return chatMessage{}, err
	}
	data, _, err := c.do(http.MethodPost, "/conversations/"+url.PathEscape(conversationID)+"/messages", map[string]string{
		"body": normalized,
	})
	if err != nil {
		return chatMessage{}, err
	}
	var out chatMessage
	return out, json.Unmarshal(data, &out)
}

func normalizeMessageBody(body string) (string, error) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return "", fmt.Errorf("message body cannot be empty")
	}
	if utf8.RuneCountInString(trimmed) > maxMessageRunes {
		return "", fmt.Errorf("message body exceeds %d characters", maxMessageRunes)
	}
	return trimmed, nil
}
