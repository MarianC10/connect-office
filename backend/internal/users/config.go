package users

import (
	"os"
	"strings"
)

type Config struct {
	StaticFilesBaseURL string
	AvatarUploadDir    string
}

func LoadConfigFromEnv() Config {
	base := strings.TrimSpace(os.Getenv("STATIC_FILES_BASE_URL"))
	if base == "" {
		base = "http://localhost:8082"
	}
	uploadDir := strings.TrimSpace(os.Getenv("AVATAR_UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = "static/avatars"
	}
	return Config{
		StaticFilesBaseURL: strings.TrimRight(base, "/"),
		AvatarUploadDir:    uploadDir,
	}
}

func (c Config) DefaultAvatarURL() string {
	return c.StaticFilesBaseURL + "/avatars/default.png"
}
