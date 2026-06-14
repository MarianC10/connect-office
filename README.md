# connect-office

## Development guide

### Branching model (trunk-based development)
- **Trunk**: `main` is the trunk and must remain releasable.
- **Feature branches**: create **short-lived** branches off `main` (hours to a couple of days).
  - Naming examples: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- **No direct pushes to `main`**: all changes land via PR.

### Local workflow
- **Sync**: pull latest `main` before starting work.
- **Small slices**: keep changes small and merge frequently.
- **Rebase/merge from `main`**: keep your branch current if it lives longer than a day.

### Pull requests
- **PR required**: open a PR from your branch into `main`.
- **Definition of done**:
  - Tests pass (and new tests are added when appropriate).
  - No obvious lint/typecheck failures.
  - PR description explains the “why” and any rollout/flag instructions.

### Merging policy (squash merge)
- **Squash merge only** into `main`.
- **Squash commit message must be descriptive** and explain what the feature/change does.
  - Prefer a short title + helpful body, for example:
    - Title: `Add office check-in flow`
    - Body: what changed, user impact, and any follow-ups.

### Feature flags for risky/experimental work
Use **feature flags** for changes that are incomplete, risky, or experimental so `main` stays stable.
- **Guard**: new UI paths, endpoints, background jobs, or behavior changes that are not fully ready.
- **Default state**: flags should default to **off** unless the rollout plan says otherwise.
- **Rollout**: document how to enable/disable the flag in the PR and/or release notes.
- **Cleanup**: once stable, remove the flag and dead code.

### Repository rules (summary)
- **No direct pushes to `main`**
- **Short-lived branches**
- **Squash merges with meaningful messages**
- **Feature flags for experimental/incomplete features**

## Backend static images

- Location images are stored in `locations.images` as a JSONB list of objects: `[{ "id": "...", "url": "..." }]`.
- Docker Compose serves static files with `nginx` on `http://localhost:8082`.
- Put image files under `backend/static/locations/...` so URLs from DB resolve correctly.

## Run Backend Application

1. Start dependencies:
   - From CLI: `cd backend && docker compose up -d`
   - Or start the same services from Docker Desktop.
2. Seed the database:
   - `cd backend`
   - `go run ./cmd/seed`
3. Start the backend server:
   - `cd backend`
   - `go run ./cmd/server`

### Stripe subscriptions (local webhooks)

Stripe activates subscriptions via webhooks when checkout completes. For local development, forward events from Stripe to your backend with the Stripe CLI:

1. Install the CLI globally:
   - `npm i -g @stripe/stripe-cli`
2. Log in to your Stripe account (session expires after 90 days):
   - `npx stripe login`
3. Forward webhook events to the backend (default port `8080`; change if your server uses another port):
   - `npx stripe listen --forward-to localhost:8080/subscriptions/webhook`

Keep the `stripe listen` process running while testing checkout. Set `STRIPE_SECRET_KEY` in `backend/.env` (see `backend/.env.example`).

Stripe Price IDs for each plan are stored in `subscription_plans.stripe_price_id` and applied when you run `go run ./cmd/seed` from `backend/`.

### Closing / cleanup

- Stop and remove backend dependencies:
  - From CLI: `cd backend && docker compose down -v`
  - Or stop/remove the same containers from Docker Desktop.
- Stop the backend server by closing the terminal window (or pressing `Ctrl+C` in that terminal).