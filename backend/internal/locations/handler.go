package locations

import (
	"encoding/json"
	"net/http"
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
