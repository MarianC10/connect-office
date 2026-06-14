package subscriptions

import (
	"fmt"
	"html"
	"net/http"
	"strings"
)

func NewCheckoutReturnHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.Enabled {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		checkout := strings.TrimSpace(r.URL.Query().Get("checkout"))
		switch checkout {
		case "success", "cancel":
		default:
			http.Error(w, "checkout query must be success or cancel", http.StatusBadRequest)
			return
		}

		appRedirect := strings.TrimSpace(r.URL.Query().Get("app_redirect"))
		if appRedirect != "" {
			if err := validateCheckoutRedirectURL(appRedirect); err != nil {
				http.Error(w, "invalid app_redirect", http.StatusBadRequest)
				return
			}
		}

		title := "Returning to Connect Office"
		message := "Returning to the app..."
		if checkout == "success" {
			message = "Payment complete. Returning to the app..."
		} else {
			message = "Checkout cancelled. Returning to the app..."
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, checkoutReturnHTML(title, message, appRedirect))
	}
}

func checkoutReturnHTML(title, message, appRedirect string) string {
	escapedTitle := html.EscapeString(title)
	escapedMessage := html.EscapeString(message)
	escapedRedirect := html.EscapeString(appRedirect)

	var redirectScript string
	var linkHTML string
	if appRedirect != "" {
		redirectScript = fmt.Sprintf(
			`<script>window.location.replace(%q);</script>`,
			appRedirect,
		)
		linkHTML = fmt.Sprintf(
			`<p><a href=%q>Tap here if you are not redirected automatically</a></p>`,
			escapedRedirect,
		)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%s</title>
  %s
</head>
<body>
  <p>%s</p>
  %s
</body>
</html>`, escapedTitle, redirectScript, escapedMessage, linkHTML)
}
