Static image assets served by `nginx` in `docker-compose.yml`.

Expected URL base:

- `http://localhost:8082/locations/...`

Seed data expects these files:

- `locations/cluj/lobby.jpg`
- `locations/cluj/open-space.jpg`
- `locations/bucharest/exterior.jpg`
- `locations/bucharest/meeting-room.jpg`
- `locations/timisoara/common-area.jpg`
- `locations/timisoara/focus-zone.jpg`

Add real image files at those paths to make seeded URLs resolvable.
