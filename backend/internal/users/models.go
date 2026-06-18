package users

type MeResponse struct {
	ID            string `json:"id"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified"`
	Role          string `json:"role"`
	DisplayName   string `json:"display_name"`
	IsPublic      bool   `json:"is_public"`
	AvatarURL     string `json:"avatar_url"`
}

type UpdateMeRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	IsPublic    *bool   `json:"is_public,omitempty"`
}

type PublicProfileResponse struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsPublic    bool   `json:"is_public"`
	AvatarURL   string `json:"avatar_url"`
}

type LookupByEmailRequest struct {
	Email string `json:"email"`
}
