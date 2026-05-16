package users

type MeResponse struct {
	ID            string `json:"id"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified"`
}
