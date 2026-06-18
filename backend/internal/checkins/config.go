package checkins

type Config struct{}

func LoadConfigFromEnv() Config {
	return Config{}
}

func (Config) IsEnabled() bool {
	return true
}
