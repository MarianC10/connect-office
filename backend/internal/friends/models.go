package friends

type CreateRequestBody struct {
	UserID string `json:"user_id,omitempty"`
	Email  string `json:"email,omitempty"`
}

type FriendRequestResponse struct {
	ID          string `json:"id"`
	FromUserID  string `json:"from_user_id"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	CreatedAt   string `json:"created_at"`
}

type FriendResponse struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsPublic    bool   `json:"is_public"`
	AvatarURL   string `json:"avatar_url"`
}
