package locations

import (
	"testing"
	"time"
)

func TestIsWithinWorkingHoursWeekday(t *testing.T) {
	loc := Location{
		Timezone:     "Europe/Bucharest",
		WeekdayOpen:  "09:00",
		WeekdayClose: "18:00",
		WeekendOpen:  "10:00",
		WeekendClose: "16:00",
	}
	tz, err := time.LoadLocation("Europe/Bucharest")
	if err != nil {
		t.Fatal(err)
	}
	// Wednesday 2026-06-17 10:00 Bucharest
	now := time.Date(2026, 6, 17, 10, 0, 0, 0, tz)
	open, err := IsWithinWorkingHours(loc, now.UTC())
	if err != nil {
		t.Fatal(err)
	}
	if !open {
		t.Fatal("expected office to be open")
	}
}

func TestIsWithinWorkingHoursClosedDayOverride(t *testing.T) {
	closed := true
	loc := Location{
		Timezone:     "Europe/Bucharest",
		WeekdayOpen:  "09:00",
		WeekdayClose: "18:00",
		HoursOverrides: HoursOverridesMap{
			"2026-06-17": {Closed: &closed},
		},
	}
	tz, _ := time.LoadLocation("Europe/Bucharest")
	now := time.Date(2026, 6, 17, 10, 0, 0, 0, tz)
	open, err := IsWithinWorkingHours(loc, now.UTC())
	if err != nil {
		t.Fatal(err)
	}
	if open {
		t.Fatal("expected closed override")
	}
}

func TestIsWithinWorkingHours24Hour(t *testing.T) {
	loc := Location{
		Timezone:     "Europe/Bucharest",
		WeekdayOpen:  "00:00",
		WeekdayClose: "00:00",
		WeekendOpen:  "00:00",
		WeekendClose: "00:00",
	}
	tz, err := time.LoadLocation("Europe/Bucharest")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 6, 17, 3, 30, 0, 0, tz)
	open, err := IsWithinWorkingHours(loc, now.UTC())
	if err != nil {
		t.Fatal(err)
	}
	if !open {
		t.Fatal("expected 24-hour office to be open")
	}
}
