package checkins

type VisibleCheckInResponse struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	IsFriend    bool   `json:"is_friend"`
	AvatarURL   string `json:"avatar_url"`
}
