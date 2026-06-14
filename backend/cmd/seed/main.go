package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	locCluj  = uuid.MustParse("a0000001-0000-4000-8000-000000000001")
	locBuch  = uuid.MustParse("a0000002-0000-4000-8000-000000000002")
	locTimis = uuid.MustParse("a0000003-0000-4000-8000-000000000003")

	amHotDesks   = uuid.MustParse("b0000001-0000-4000-8000-000000000001")
	amMeeting    = uuid.MustParse("b0000002-0000-4000-8000-000000000002")
	amFiber      = uuid.MustParse("b0000003-0000-4000-8000-000000000003")
	amPhoneBooth = uuid.MustParse("b0000004-0000-4000-8000-000000000004")
	amBike       = uuid.MustParse("b0000005-0000-4000-8000-000000000005")
	amShowers    = uuid.MustParse("b0000006-0000-4000-8000-000000000006")
	amCoffee     = uuid.MustParse("b0000007-0000-4000-8000-000000000007")
	amAccessible = uuid.MustParse("b0000008-0000-4000-8000-000000000008")
	amParking    = uuid.MustParse("b0000009-0000-4000-8000-000000000009")
	amPrint      = uuid.MustParse("b000000a-0000-4000-8000-00000000000a")
	amQuiet      = uuid.MustParse("b000000b-0000-4000-8000-00000000000b")
)

type seedLocation struct {
	ID          uuid.UUID
	Name        string
	Description string
	Address     string
	City        string
	County      string
	Country     string
	Latitude    float64
	Longitude   float64
	Capacity    int
	Images      []seedLocationImage
}

type seedLocationImage struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

type seedAmenity struct {
	ID       uuid.UUID
	Name     string
	Category string
}

var locationsSeed = []seedLocation{
	{
		ID:          locCluj,
		Name:        "Connect Office — Cluj",
		Description: "Main hub near the old town with flexible desks and bookable meeting rooms.",
		Address:     "Bulevardul 21 Decembrie 1989 nr. 77",
		City:        "Cluj-Napoca",
		County:      "Cluj",
		Country:     "Romania",
		Latitude:    46.7709,
		Longitude:   23.5969,
		Capacity:    40,
		Images: []seedLocationImage{
			{ID: "cluj-lobby", URL: "http://localhost:8082/locations/cluj/lobby.jpg"},
			{ID: "cluj-open-space", URL: "http://localhost:8082/locations/cluj/open-space.jpg"},
		},
	},
	{
		ID:          locBuch,
		Name:        "Connect Office — Bucharest North",
		Description: "North Bucharest location with quick access to Pipera business district.",
		Address:     "Soseaua Bucuresti-Ploiesti nr. 172-176, sector 1",
		City:        "Bucharest",
		County:      "Bucharest",
		Country:     "Romania",
		Latitude:    44.5112,
		Longitude:   26.0840,
		Capacity:    60,
		Images: []seedLocationImage{
			{ID: "bucharest-exterior", URL: "http://localhost:8082/locations/bucharest/exterior.jpg"},
			{ID: "bucharest-meeting-room", URL: "http://localhost:8082/locations/bucharest/meeting-room.jpg"},
		},
	},
	{
		ID:          locTimis,
		Name:        "Connect Office — Timisoara",
		Description: "Central Timisoara workspace on the main boulevard.",
		Address:     "Bulevardul Revolutiei din 1989 nr. 5",
		City:        "Timisoara",
		County:      "Timis",
		Country:     "Romania",
		Latitude:    45.7489,
		Longitude:   21.2087,
		Capacity:    30,
		Images: []seedLocationImage{
			{ID: "timisoara-common-area", URL: "http://localhost:8082/locations/timisoara/common-area.jpg"},
			{ID: "timisoara-focus-zone", URL: "http://localhost:8082/locations/timisoara/focus-zone.jpg"},
		},
	},
}

var amenitiesSeed = []seedAmenity{
	{ID: amHotDesks, Name: "Hot desks", Category: "workspace"},
	{ID: amMeeting, Name: "Meeting rooms", Category: "workspace"},
	{ID: amFiber, Name: "Fiber internet", Category: "connectivity"},
	{ID: amPhoneBooth, Name: "Phone booths", Category: "workspace"},
	{ID: amBike, Name: "Bike storage", Category: "parking"},
	{ID: amShowers, Name: "Showers", Category: "wellness"},
	{ID: amCoffee, Name: "Coffee & tea bar", Category: "food_beverage"},
	{ID: amAccessible, Name: "Step-free access", Category: "accessibility"},
	{ID: amParking, Name: "Visitor parking", Category: "parking"},
	{ID: amPrint, Name: "Print & scan", Category: "workspace"},
	{ID: amQuiet, Name: "Quiet focus zone", Category: "workspace"},
}

type seedLink struct {
	LocationID uuid.UUID
	AmenityID  uuid.UUID
}

var locationAmenitiesSeed = []seedLink{
	{LocationID: locCluj, AmenityID: amHotDesks},
	{LocationID: locCluj, AmenityID: amMeeting},
	{LocationID: locCluj, AmenityID: amFiber},
	{LocationID: locCluj, AmenityID: amPhoneBooth},
	{LocationID: locCluj, AmenityID: amBike},
	{LocationID: locCluj, AmenityID: amCoffee},
	{LocationID: locCluj, AmenityID: amAccessible},
	{LocationID: locBuch, AmenityID: amHotDesks},
	{LocationID: locBuch, AmenityID: amMeeting},
	{LocationID: locBuch, AmenityID: amFiber},
	{LocationID: locBuch, AmenityID: amParking},
	{LocationID: locBuch, AmenityID: amPrint},
	{LocationID: locBuch, AmenityID: amCoffee},
	{LocationID: locBuch, AmenityID: amQuiet},
	{LocationID: locTimis, AmenityID: amHotDesks},
	{LocationID: locTimis, AmenityID: amMeeting},
	{LocationID: locTimis, AmenityID: amFiber},
	{LocationID: locTimis, AmenityID: amShowers},
	{LocationID: locTimis, AmenityID: amBike},
	{LocationID: locTimis, AmenityID: amAccessible},
}

type seedSubscriptionPlan struct {
	PlanType      string
	Name          string
	Perks         []string
	StripePriceID string
	SortOrder     int
}

var subscriptionPlansSeed = []seedSubscriptionPlan{
	{
		PlanType:      "entrances_10",
		Name:          "10 Entrances",
		Perks:         []string{"10 office visits", "Use anytime"},
		StripePriceID: "price_1TiJsECIn96S0hwmeIhTZI1C",
		SortOrder:     1,
	},
	{
		PlanType:      "monthly",
		Name:          "Monthly",
		Perks:         []string{"Unlimited entrances", "Renews monthly"},
		StripePriceID: "price_1TiJsrCIn96S0hwm109VmxzE",
		SortOrder:     2,
	},
	{
		PlanType:      "yearly",
		Name:          "Yearly",
		Perks:         []string{"Unlimited entrances", "Best value"},
		StripePriceID: "price_1TiJtICIn96S0hwmYDhnRzpQ",
		SortOrder:     3,
	},
}

func main() {
	if err := godotenv.Load(".env"); err != nil {
		_ = godotenv.Load("backend/.env")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required (copy backend/.env.example to backend/.env or export DATABASE_URL)")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("db pool: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `TRUNCATE TABLE location_amenities, amenities, locations RESTART IDENTITY CASCADE`); err != nil {
		log.Fatalf("truncate: %v", err)
	}

	for _, loc := range locationsSeed {
		imagesJSON, err := json.Marshal(loc.Images)
		if err != nil {
			log.Fatalf("marshal images for %s: %v", loc.Name, err)
		}

		_, err = tx.Exec(ctx, `
INSERT INTO locations (id, name, description, address, city, county, country, latitude, longitude, capacity, images)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
			loc.ID, loc.Name, loc.Description, loc.Address, loc.City, loc.County, loc.Country, loc.Latitude, loc.Longitude, loc.Capacity, imagesJSON)
		if err != nil {
			log.Fatalf("insert location %s: %v", loc.Name, err)
		}
	}

	for _, a := range amenitiesSeed {
		_, err := tx.Exec(ctx, `
INSERT INTO amenities (id, name, category) VALUES ($1, $2, $3::amenity_category)`,
			a.ID, a.Name, a.Category)
		if err != nil {
			log.Fatalf("insert amenity %s: %v", a.Name, err)
		}
	}

	for _, link := range locationAmenitiesSeed {
		_, err := tx.Exec(ctx, `
INSERT INTO location_amenities (location_id, amenity_id) VALUES ($1, $2)`,
			link.LocationID, link.AmenityID)
		if err != nil {
			log.Fatalf("link %s -> %s: %v", link.LocationID, link.AmenityID, err)
		}
	}

	for _, plan := range subscriptionPlansSeed {
		perksJSON, err := json.Marshal(plan.Perks)
		if err != nil {
			log.Fatalf("marshal perks for %s: %v", plan.PlanType, err)
		}

		_, err = tx.Exec(ctx, `
INSERT INTO subscription_plans (plan_type, name, perks, stripe_price_id, sort_order)
VALUES ($1, $2, $3::jsonb, $4, $5)
ON CONFLICT (plan_type) DO UPDATE SET
	name = EXCLUDED.name,
	perks = EXCLUDED.perks,
	stripe_price_id = EXCLUDED.stripe_price_id,
	sort_order = EXCLUDED.sort_order,
	updated_at = now()`,
			plan.PlanType, plan.Name, perksJSON, plan.StripePriceID, plan.SortOrder)
		if err != nil {
			log.Fatalf("upsert subscription plan %s: %v", plan.PlanType, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit: %v", err)
	}

	fmt.Println("seed completed:", len(locationsSeed), "locations,", len(amenitiesSeed), "amenities,", len(locationAmenitiesSeed), "links,", len(subscriptionPlansSeed), "subscription plans")
}
