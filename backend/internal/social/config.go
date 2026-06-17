package social

import (
	"os"
	"strings"
)

type Config struct {
	Enabled bool
}

func LoadConfigFromEnv() Config {
	env := strings.TrimSpace(os.Getenv("SOCIAL_ENABLED"))
	enabled := env == "" || strings.EqualFold(env, "true")
	return Config{Enabled: enabled}
}
