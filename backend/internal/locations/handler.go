package locations

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func NewGetLocationsHandler(svc *Service) http.HandlerFunc {
	return func(respWriter http.ResponseWriter, req *http.Request) {
		items, err := svc.ListLocations(req.Context())
		if err != nil {
			http.Error(respWriter, err.Error(), http.StatusInternalServerError)
			return
		}
		body, err := json.Marshal(items)
		if err != nil {
			http.Error(respWriter, err.Error(), http.StatusInternalServerError)
			return
		}
		respWriter.Header().Set("Content-Type", "application/json")
		respWriter.WriteHeader(http.StatusOK)
		respWriter.Write(body)
	}
}

func NewGetLocationByIDHandler(svc *Service) http.HandlerFunc {
	return func(respWriter http.ResponseWriter, req *http.Request) {
		id := strings.TrimPrefix(req.URL.Path, "/locations/")
		if id == "" || strings.Contains(id, "/") {
			http.Error(respWriter, "invalid location id", http.StatusBadRequest)
			return
		}

		item, err := svc.GetLocationByID(req.Context(), id)
		if err != nil {
			if errors.Is(err, ErrLocationNotFound) {
				http.Error(respWriter, err.Error(), http.StatusNotFound)
				return
			}
			http.Error(respWriter, err.Error(), http.StatusInternalServerError)
			return
		}
		body, err := json.Marshal(item)
		if err != nil {
			http.Error(respWriter, err.Error(), http.StatusInternalServerError)
			return
		}
		respWriter.Header().Set("Content-Type", "application/json")
		respWriter.WriteHeader(http.StatusOK)
		respWriter.Write(body)
	}
}
