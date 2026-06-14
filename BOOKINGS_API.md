# Bookings API

Backend contract for office day reservations. All endpoints require a Supabase access token:

```
Authorization: Bearer <access_token>
```

The booking window and calendar days use **Europe/Bucharest**. Dates are `YYYY-MM-DD`.

## Locations (updated)

Existing endpoints now include `capacity` (desk count).

### `GET /locations`

### `GET /locations/{id}`

**Response excerpt:**

```json
{
  "id": "a0000001-0000-4000-8000-000000000001",
  "name": "Connect Office — Cluj",
  "capacity": 40,
  "city": "Cluj-Napoca",
  "images": [{ "id": "cluj-lobby", "url": "http://..." }],
  "amenities": [{ "name": "Hot desks", "category": "workspace" }]
}
```

## Availability

### `GET /locations/{id}/availability?date=YYYY-MM-DD`

Returns occupancy for one location on one day. The `date` must fall within the booking window (today through today + 9 days, Bucharest).

**Response:**

```json
{
  "location_id": "a0000001-0000-4000-8000-000000000001",
  "booking_date": "2026-06-20",
  "capacity": 40,
  "booked_count": 42,
  "status": "busy"
}
```

**`status` values:**

| Status | Meaning |
|--------|---------|
| `available` | Under 100% capacity — normal booking |
| `busy` | At or above capacity but below 150% — warn user; booking allowed |
| `full` | At or above `ceil(capacity × 1.5)` — no more bookings |

**Errors:** 400 (missing/invalid date or out of window), 404 (unknown location).

## Bookings

### `POST /bookings`

Create a reservation.

**Body:**

```json
{
  "location_id": "a0000001-0000-4000-8000-000000000001",
  "booking_date": "2026-06-20"
}
```

**Rules:**

- One confirmed booking per user per calendar day (any office).
- Booking window: today through today + 9 days (Bucharest).
- Rejected when location is `full` (150% hard limit).

**Response (201):**

```json
{
  "id": "b1111111-1111-4111-8111-111111111111",
  "booking_date": "2026-06-20",
  "status": "confirmed",
  "location": {
    "id": "a0000001-0000-4000-8000-000000000001",
    "name": "Connect Office — Cluj",
    "city": "Cluj-Napoca",
    "image_url": "http://localhost:8082/locations/cluj/lobby.jpg"
  },
  "created_at": "2026-06-14T10:00:00Z"
}
```

**Errors:**

| Code | Reason |
|------|--------|
| 400 | Invalid JSON, missing fields, bad date format, date out of window |
| 404 | Unknown location |
| 409 | User already booked that day, or location full |

### `GET /bookings`

List the current user's confirmed bookings, ordered by `booking_date` ascending.

**Response (200):** array of `BookingResponse` (same shape as create).

### `DELETE /bookings/{id}`

Cancel the user's own confirmed booking (soft cancel).

**Response:** 204 No Content

**Errors:** 404 if booking not found or not owned by the user.

## Mobile integration (deferred)

Suggested work for the frontend contributor:

### Office detail — `mobile/app/office/[id].tsx`

1. `GET /locations/{id}` — office info + `capacity`
2. Horizontal 10-day date chips (today … today+9)
3. On date select: `GET /locations/{id}/availability?date=`
4. Banners:
   - `busy`: *"This office is busy on this day — seating may be limited."*
   - `full`: *"Fully booked for this day."* — disable Reserve
5. `POST /bookings` on Reserve; handle 409 (duplicate day vs full office)

### Bookings list — `mobile/app/profile/bookings.tsx`

1. `GET /bookings` on mount + pull-to-refresh
2. Optional `DELETE /bookings/{id}` to cancel

### API helpers — `mobile/lib/`

Add typed wrappers around `getAccessToken()` from `mobile/lib/api.ts`:

- `getLocationById(id)`
- `getLocationAvailability(id, date)`
- `listBookings()`
- `createBooking({ locationId, bookingDate })`
- `cancelBooking(id)`

## Local testing

1. Run migrations: `go run ./cmd/migrate` from `backend/`
2. Re-seed locations: `go run ./cmd/seed`
3. Obtain JWT via mobile login or Supabase dashboard
4. Provision user: `GET /me`
5. Exercise endpoints with curl or a REST client

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/locations/a0000001-0000-4000-8000-000000000001/availability?date=2026-06-20"

curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"location_id":"a0000001-0000-4000-8000-000000000001","booking_date":"2026-06-20"}' \
  http://localhost:8080/bookings
```
