package chat

type MessageResponse struct {
	ID         string `json:"id"`
	SenderID   string `json:"sender_id"`
	Body       string `json:"body"`
	CreatedAt  string `json:"created_at"`
}

type LastMessagePreview struct {
	ID        string `json:"id"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}

type ConversationFriend struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type ConversationResponse struct {
	ID          string              `json:"id"`
	Friend      ConversationFriend  `json:"friend"`
	LastMessage *LastMessagePreview `json:"last_message"`
}

type SendMessageBody struct {
	Body string `json:"body"`
}
