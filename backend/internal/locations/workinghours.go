package locations

import (
	"fmt"
	"strings"
	"time"
)

func DefaultTimezone() string {
	return "Europe/Bucharest"
}

func VisitDateInTimezone(tzName string, now time.Time) (time.Time, error) {
	loc, err := loadTimezone(tzName)
	if err != nil {
		return time.Time{}, err
	}
	local := now.In(loc)
	y, m, d := local.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC), nil
}

func FormatVisitDate(date time.Time) string {
	return date.Format("2006-01-02")
}

func IsWeekend(t time.Time, tzName string) (bool, error) {
	loc, err := loadTimezone(tzName)
	if err != nil {
		return false, err
	}
	wd := t.In(loc).Weekday()
	return wd == time.Saturday || wd == time.Sunday, nil
}

type DaySchedule struct {
	Open  string
	Close string
}

func Is24HourSchedule(schedule DaySchedule) bool {
	open := normalizeClockValue(schedule.Open)
	closeTime := normalizeClockValue(schedule.Close)
	return open == "00:00" && (closeTime == "00:00" || closeTime == "24:00")
}

func normalizeClockValue(clock string) string {
	clock = strings.TrimSpace(clock)
	if len(clock) >= 5 {
		return clock[:5]
	}
	return clock
}

func ScheduleForDate(loc Location, visitDate time.Time) (DaySchedule, bool, error) {
	dateKey := FormatVisitDate(visitDate)
	if override, ok := loc.HoursOverrides.Map()[dateKey]; ok {
		if override.Closed != nil && *override.Closed {
			return DaySchedule{}, false, nil
		}
		open := strings.TrimSpace(override.Open)
		closeTime := strings.TrimSpace(override.Close)
		if open != "" && closeTime != "" {
			return DaySchedule{Open: open, Close: closeTime}, true, nil
		}
	}

	weekend, err := IsWeekend(visitDate, loc.Timezone)
	if err != nil {
		return DaySchedule{}, false, err
	}
	if weekend {
		return DaySchedule{Open: loc.WeekendOpen, Close: loc.WeekendClose}, true, nil
	}
	return DaySchedule{Open: loc.WeekdayOpen, Close: loc.WeekdayClose}, true, nil
}

func OpenCloseInstants(loc Location, visitDate time.Time) (open, close time.Time, openToday bool, err error) {
	schedule, openToday, err := ScheduleForDate(loc, visitDate)
	if err != nil || !openToday {
		return time.Time{}, time.Time{}, openToday, err
	}
	tz, err := loadTimezone(loc.Timezone)
	if err != nil {
		return time.Time{}, time.Time{}, false, err
	}
	y, m, d := visitDate.Date()
	openAt, err := combineDateAndClock(y, m, d, schedule.Open, tz)
	if err != nil {
		return time.Time{}, time.Time{}, false, err
	}
	if Is24HourSchedule(schedule) {
		return openAt, openAt.Add(24 * time.Hour), true, nil
	}
	closeAt, err := combineDateAndClock(y, m, d, schedule.Close, tz)
	if err != nil {
		return time.Time{}, time.Time{}, false, err
	}
	if !closeAt.After(openAt) {
		return time.Time{}, time.Time{}, false, fmt.Errorf("closing time must be after opening time")
	}
	return openAt, closeAt, true, nil
}

func IsWithinWorkingHours(loc Location, now time.Time) (bool, error) {
	visitDate, err := VisitDateInTimezone(loc.Timezone, now)
	if err != nil {
		return false, err
	}
	openAt, closeAt, openToday, err := OpenCloseInstants(loc, visitDate)
	if err != nil {
		return false, err
	}
	if !openToday {
		return false, nil
	}
	return !now.Before(openAt) && now.Before(closeAt), nil
}

func loadTimezone(tzName string) (*time.Location, error) {
	tzName = strings.TrimSpace(tzName)
	if tzName == "" {
		tzName = DefaultTimezone()
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tzName, err)
	}
	return loc, nil
}

func combineDateAndClock(y int, m time.Month, d int, clock string, loc *time.Location) (time.Time, error) {
	if normalizeClockValue(clock) == "24:00" {
		return time.Date(y, m, d, 0, 0, 0, 0, loc).Add(24 * time.Hour), nil
	}
	h, min, sec, err := parseClock(clock)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(y, m, d, h, min, sec, 0, loc), nil
}

func parseClock(clock string) (hour, min, sec int, err error) {
	clock = strings.TrimSpace(clock)
	if clock == "" {
		return 0, 0, 0, fmt.Errorf("empty time")
	}
	if normalizeClockValue(clock) == "24:00" {
		return 24, 0, 0, nil
	}
	layouts := []string{"15:04:05", "15:04"}
	for _, layout := range layouts {
		t, parseErr := time.Parse(layout, clock)
		if parseErr == nil {
			return t.Hour(), t.Minute(), t.Second(), nil
		}
	}
	return 0, 0, 0, fmt.Errorf("invalid time %q", clock)
}
