package main

import (
	"log"
	"net/http"

	"github.com/MarianC10/connect-office/backend/locations"
)

func main() {
	http.HandleFunc("/locations", locations.GetLocationsHandler)
	log.Println("Server is running on port 8080")
	http.ListenAndServe(":8080", nil)
}
