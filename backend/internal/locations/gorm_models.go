package locations

import (
	"time"

	"github.com/google/uuid"
)

// AmenityCategory is the Go counterpart of PostgreSQL enum amenity_category.
type AmenityCategory string

const (
	AmenityCategoryWorkspace     AmenityCategory = "workspace"
	AmenityCategoryConnectivity  AmenityCategory = "connectivity"
	AmenityCategoryWellness      AmenityCategory = "wellness"
	AmenityCategoryFoodBeverage  AmenityCategory = "food_beverage"
	AmenityCategoryAccessibility AmenityCategory = "accessibility"
	AmenityCategoryParking       AmenityCategory = "parking"
	AmenityCategoryOther         AmenityCategory = "other"
)

type Location struct {
	ID          uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string    `gorm:"column:name;type:text;not null"`
	Description string    `gorm:"column:description;type:text;not null;default:''"`
	Address     string    `gorm:"column:address;type:text;not null"`
	City        string    `gorm:"column:city;type:text;not null"`
	County      string    `gorm:"column:county;type:text;not null"`
	Country     string    `gorm:"column:country;type:text;not null"`
	Latitude    float64   `gorm:"column:latitude;type:double precision;not null"`
	Longitude   float64   `gorm:"column:longitude;type:double precision;not null"`
	Capacity    int        `gorm:"column:capacity;type:integer;not null;default:40"`
	OwnerID     *uuid.UUID `gorm:"column:owner_id;type:uuid"`
	Images      LocationImageList `gorm:"column:images;type:jsonb;not null;default:'[]'"`
	Timezone      string            `gorm:"column:timezone;type:text;not null;default:'Europe/Bucharest'"`
	WeekdayOpen   string            `gorm:"column:weekday_open;type:time;not null;default:'09:00'"`
	WeekdayClose  string            `gorm:"column:weekday_close;type:time;not null;default:'18:00'"`
	WeekendOpen   string            `gorm:"column:weekend_open;type:time;not null;default:'10:00'"`
	WeekendClose  string            `gorm:"column:weekend_close;type:time;not null;default:'16:00'"`
	HoursOverrides HoursOverridesMap `gorm:"column:hours_overrides;type:jsonb;not null;default:'{}'"`
	CreatedAt   time.Time `gorm:"column:created_at;type:timestamptz;not null;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;type:timestamptz;not null;autoUpdateTime"`

	// Junction table location_amenities: location_id → locations.id, amenity_id → amenities.id
	Amenities []Amenity `gorm:"many2many:location_amenities;joinForeignKey:LocationID;joinReferences:AmenityID"`
}

type LocationImage struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

func (Location) TableName() string {
	return "locations"
}

type Amenity struct {
	ID       uuid.UUID       `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	Name     string          `gorm:"column:name;type:text;not null"`
	Category AmenityCategory `gorm:"column:category;type:amenity_category;not null"`
}

func (Amenity) TableName() string {
	return "amenities"
}
