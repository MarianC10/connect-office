package main

import (
	"context"
	"log"
	"os"

	"github.com/MarianC10/connect-office/backend/internal/migrations"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		_ = godotenv.Load("backend/.env")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required (copy backend/.env.example to backend/.env or export DATABASE_URL)")
	}

	ctx := context.Background()
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("gorm open: %v", err)
	}

	if err := migrations.Run(ctx, db); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	log.Println("migrations completed")
}
