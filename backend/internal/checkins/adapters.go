package checkins

import (
	"context"
	"fmt"
	"time"

	"github.com/MarianC10/connect-office/backend/internal/bookings"
	"github.com/MarianC10/connect-office/backend/internal/locations"
	"github.com/MarianC10/connect-office/backend/internal/users"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserDisplayReader struct {
	Store *users.PostgresStore
}

func (r *UserDisplayReader) GetDisplayNames(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]users.User, error) {
	items, err := r.Store.GetByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]users.User, len(items))
	for _, u := range items {
		out[u.ID] = u
	}
	return out, nil
}

type OwnerBookingsReader struct {
	DB *gorm.DB
}

func (r *OwnerBookingsReader) ListBookings(ctx context.Context, ownerID uuid.UUID, date time.Time, locationID *uuid.UUID) ([]ownerBookingRow, error) {
	type row struct {
		BookingID    uuid.UUID
		LocationID   uuid.UUID
		LocationName string
		BookingDate  time.Time
		Status       string
		RenterID     uuid.UUID
		RenterName   string
		RenterEmail  *string
		Images       locations.LocationImageList `gorm:"column:images;type:jsonb"`
	}

	q := r.DB.WithContext(ctx).
		Table("bookings b").
		Select(`b.id AS booking_id, b.location_id, l.name AS location_name, b.booking_date, b.status,
			u.id AS renter_id, u.display_name AS renter_name, u.email AS renter_email, l.images`).
		Joins("JOIN locations l ON l.id = b.location_id").
		Joins("JOIN users u ON u.id = b.user_id").
		Where("l.owner_id = ? AND b.booking_date = ? AND b.status = ?", ownerID, date, bookings.BookingStatusConfirmed)

	if locationID != nil {
		q = q.Where("b.location_id = ?", *locationID)
	}

	var rows []row
	if err := q.Order("l.name ASC, u.display_name ASC").Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("list owner bookings for presence: %w", err)
	}

	out := make([]ownerBookingRow, 0, len(rows))
	for _, r := range rows {
		item := ownerBookingRow{
			ID:           r.BookingID,
			LocationID:   r.LocationID,
			LocationName: r.LocationName,
			BookingDate:  r.BookingDate,
			RenterID:     r.RenterID,
			RenterName:   r.RenterName,
			RenterEmail:  r.RenterEmail,
			Status:       r.Status,
		}
		if len(r.Images) > 0 {
			item.LocationImageURL = r.Images.Slice()[0].URL
		}
		out = append(out, item)
	}
	return out, nil
}
