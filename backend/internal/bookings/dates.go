package bookings

import (
	"fmt"
	"time"
)

const bookingDateLayout = "2006-01-02"

var bucharestLoc *time.Location

func init() {
	loc, err := time.LoadLocation("Europe/Bucharest")
	if err != nil {
		panic(fmt.Sprintf("load Europe/Bucharest: %v", err))
	}
	bucharestLoc = loc
}

func todayInBucharest() time.Time {
	now := time.Now().In(bucharestLoc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, bucharestLoc)
}

func ParseBookingDate(s string) (time.Time, error) {
	return parseBookingDate(s)
}

func ValidateBookingWindow(date time.Time) error {
	return validateBookingWindow(date)
}

func IsTodayInBucharest(date time.Time) bool {
	d := date.In(bucharestLoc)
	d = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, bucharestLoc)
	return d.Equal(todayInBucharest())
}

func TodayDateString() string {
	return formatBookingDate(todayInBucharest())
}

func FormatBookingDate(t time.Time) string {
	return formatBookingDate(t)
}

func parseBookingDate(s string) (time.Time, error) {
	t, err := time.ParseInLocation(bookingDateLayout, s, bucharestLoc)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid booking_date %q: expected YYYY-MM-DD", s)
	}
	return t, nil
}

func formatBookingDate(t time.Time) string {
	return t.In(bucharestLoc).Format(bookingDateLayout)
}

func validateBookingWindow(date time.Time) error {
	today := todayInBucharest()
	max := today.AddDate(0, 0, 9)
	if date.Before(today) || date.After(max) {
		return ErrBookingDateOutOfRange
	}
	return nil
}
