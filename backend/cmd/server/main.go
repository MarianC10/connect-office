package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/migrations"
	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/MicahParks/keyfunc/v3"
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
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("gorm sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := sqlDB.PingContext(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	if os.Getenv("RUN_MIGRATIONS_ON_STARTUP") != "false" {
		if err := migrations.Run(ctx, db); err != nil {
			log.Fatalf("run migrations: %v", err)
		}
	}

	store := locations.NewPostgresStore(db)
	locSvc := locations.NewService(store)

	jwtSecret := strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET"))
	var vopts []auth.VerifierOption
	var iss string
	if i := strings.TrimSpace(os.Getenv("SUPABASE_JWT_ISSUER")); i != "" {
		iss = i
	} else if base := strings.TrimSpace(os.Getenv("SUPABASE_URL")); base != "" {
		var err error
		iss, err = auth.IssuerFromSupabaseURL(base)
		if err != nil {
			log.Fatalf("SUPABASE_URL: %v", err)
		}
	}
	if iss != "" {
		vopts = append(vopts, auth.WithIssuer(iss))
		jwksURL, err := auth.JWKSURLFromIssuer(iss)
		if err != nil {
			log.Fatalf("jwks url: %v", err)
		}
		k, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
		if err != nil {
			log.Fatalf("jwks: %v", err)
		}
		vopts = append(vopts, auth.WithJWKS(k))
	}
	if aud := strings.TrimSpace(os.Getenv("SUPABASE_JWT_AUDIENCE")); aud != "" {
		vopts = append(vopts, auth.WithAudience(aud))
	}
	if jwtSecret == "" && iss == "" {
		log.Fatal("set SUPABASE_JWT_SECRET, or set SUPABASE_URL / SUPABASE_JWT_ISSUER for JWKS-based verification")
	}
	verifier, err := auth.NewVerifier(jwtSecret, vopts...)
	if err != nil {
		log.Fatalf("auth verifier: %v", err)
	}

	userStore := users.NewPostgresStore(db)
	userSvc := users.NewService(userStore)

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           nil,
		ReadHeaderTimeout: 10 * time.Second,
	}
	http.HandleFunc("/locations", locations.NewGetLocationsHandler(locSvc))
	http.HandleFunc("/locations/", locations.NewGetLocationByIDHandler(locSvc))
	http.Handle("/me", auth.Middleware(verifier, http.HandlerFunc(users.NewMeHandler(userSvc))))

	go func() {
		log.Println("Server is running on port 8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
