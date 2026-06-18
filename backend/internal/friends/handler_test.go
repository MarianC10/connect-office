package friends_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServeMux_routesFriendsRequestAccept(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("/friends/requests/inbox", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "inbox", http.StatusTeapot)
	}))
	mux.Handle("/friends/requests/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/friends/requests/30c9166d-33b7-44d2-8a50-7bb2236d3886/accept", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status=%d body=%q", rec.Code, rec.Body.String())
	}
}

func TestServeMux_go122AcceptPattern(t *testing.T) {
	mux := http.NewServeMux()
	mux.Handle("POST /friends/requests/{id}/accept", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.PathValue("id") != "30c9166d-33b7-44d2-8a50-7bb2236d3886" {
			t.Fatalf("id=%q", r.PathValue("id"))
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/friends/requests/30c9166d-33b7-44d2-8a50-7bb2236d3886/accept", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status=%d body=%q", rec.Code, rec.Body.String())
	}
}
