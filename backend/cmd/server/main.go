package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(httpWriter http.ResponseWriter, httpRequest *http.Request) {
		fmt.Fprintln(httpWriter, "Hello, World!")
	})
	log.Println("Server is running on port 8080")
	http.ListenAndServe(":8080", nil)
}
