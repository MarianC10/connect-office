package main

import (
	"log"
	"net/http"

	"github.com/MarianC10/connect-office/backend/internal/locations"
)

func main() {
	locSvc := locations.NewService()
	http.HandleFunc("/locations", locations.NewGetLocationsHandler(locSvc))
	log.Println("Server is running on port 8080")
	http.ListenAndServe(":8080", nil)
}
