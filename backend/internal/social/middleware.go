package social

import "net/http"

func WithSocialEnabled(cfg Config, fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.Enabled {
			http.NotFound(w, r)
			return
		}
		fn(w, r)
	}
}
