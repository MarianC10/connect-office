package owner

import (
	"os"
	"strings"
)

type Config struct {
	StaticFilesBaseURL string
	LocationUploadDir  string
}

func LoadConfigFromEnv() Config {
	base := strings.TrimSpace(os.Getenv("STATIC_FILES_BASE_URL"))
	if base == "" {
		base = "http://localhost:8082"
	}
	uploadDir := strings.TrimSpace(os.Getenv("LOCATION_UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = "static/locations"
	}
	return Config{
		StaticFilesBaseURL: strings.TrimRight(base, "/"),
		LocationUploadDir:  uploadDir,
	}
}
