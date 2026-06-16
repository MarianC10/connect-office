package migrations

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type Migration struct {
	ID          string
	Description string
	Up          func(ctx context.Context, tx *gorm.DB) error
}

var All = []Migration{
	{
		ID:          "0001_initial_schema",
		Description: "Create base locations and amenities schema",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
				`DO $$
				BEGIN
					IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'amenity_category') THEN
						CREATE TYPE amenity_category AS ENUM (
							'workspace',
							'connectivity',
							'wellness',
							'food_beverage',
							'accessibility',
							'parking',
							'other'
						);
					END IF;
				END
				$$`,
				`CREATE TABLE IF NOT EXISTS locations (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					name TEXT NOT NULL,
					description TEXT NOT NULL DEFAULT '',
					address TEXT NOT NULL,
					city TEXT NOT NULL,
					county TEXT NOT NULL,
					country TEXT NOT NULL,
					latitude DOUBLE PRECISION NOT NULL,
					longitude DOUBLE PRECISION NOT NULL,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					CONSTRAINT locations_latitude_range CHECK (latitude BETWEEN -90 AND 90),
					CONSTRAINT locations_longitude_range CHECK (longitude BETWEEN -180 AND 180)
				)`,
				`CREATE TABLE IF NOT EXISTS amenities (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					name TEXT NOT NULL,
					category amenity_category NOT NULL,
					UNIQUE (name, category)
				)`,
				`CREATE TABLE IF NOT EXISTS location_amenities (
					location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
					amenity_id UUID NOT NULL REFERENCES amenities (id) ON DELETE CASCADE,
					PRIMARY KEY (location_id, amenity_id)
				)`,
				`CREATE INDEX IF NOT EXISTS location_amenities_location_id_idx ON location_amenities (location_id)`,
			}

			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0002_location_images",
		Description: "Add JSONB image list to locations",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			return tx.WithContext(ctx).Exec(`
				ALTER TABLE locations
				ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb
			`).Error
		},
	},
	{
		ID:          "0003_users",
		Description: "Create users table for Supabase-backed identities",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			return tx.WithContext(ctx).Exec(`
				CREATE TABLE IF NOT EXISTS users (
					id UUID PRIMARY KEY,
					email TEXT,
					email_verified BOOLEAN NOT NULL DEFAULT false,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`).Error
		},
	},
	{
		ID:          "0004_location_capacity",
		Description: "Add desk capacity to locations",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			return tx.WithContext(ctx).Exec(`
				ALTER TABLE locations
				ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 40
					CHECK (capacity > 0)
			`).Error
		},
	},
	{
		ID:          "0005_bookings",
		Description: "Create bookings table",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`CREATE TABLE IF NOT EXISTS bookings (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
					booking_date DATE NOT NULL,
					status TEXT NOT NULL DEFAULT 'confirmed'
						CHECK (status IN ('confirmed', 'cancelled')),
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					UNIQUE (user_id, booking_date)
				)`,
				`CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id)`,
				`CREATE INDEX IF NOT EXISTS bookings_location_date_idx ON bookings (location_id, booking_date)`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0006_subscriptions",
		Description: "Add user subscriptions and Stripe customer id on users",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`ALTER TABLE users
				ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
				`CREATE TABLE IF NOT EXISTS user_subscriptions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					plan_type TEXT NOT NULL
						CHECK (plan_type IN ('entrances_10', 'monthly', 'yearly')),
					status TEXT NOT NULL DEFAULT 'active'
						CHECK (status IN ('active', 'expired', 'cancelled')),
					entrances_remaining INTEGER,
					starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					expires_at TIMESTAMPTZ,
					stripe_checkout_session_id TEXT,
					stripe_subscription_id TEXT,
					stripe_payment_intent_id TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)`,
				`CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions (user_id)`,
				`CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_one_active_per_user_idx
					ON user_subscriptions (user_id) WHERE status = 'active'`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0007_subscription_plans",
		Description: "Create subscription_plans catalog table",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`CREATE TABLE IF NOT EXISTS subscription_plans (
					plan_type TEXT PRIMARY KEY
						CHECK (plan_type IN ('entrances_10', 'monthly', 'yearly')),
					name TEXT NOT NULL,
					perks JSONB NOT NULL DEFAULT '[]'::jsonb,
					stripe_price_id TEXT NOT NULL DEFAULT '',
					active BOOLEAN NOT NULL DEFAULT true,
					sort_order INTEGER NOT NULL DEFAULT 0,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)`,
				`INSERT INTO subscription_plans (plan_type, name, perks, sort_order) VALUES
					('entrances_10', '10 Entrances', '["10 office visits", "Use anytime"]', 1),
					('monthly', 'Monthly', '["Unlimited entrances", "Renews monthly"]', 2),
					('yearly', 'Yearly', '["Unlimited entrances", "Best value"]', 3)
				ON CONFLICT (plan_type) DO NOTHING`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0008_subscription_checkout_session_unique",
		Description: "Unique index on stripe checkout session id for idempotent webhook activation",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			return tx.WithContext(ctx).Exec(`
				CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_checkout_session_id_idx
					ON user_subscriptions (stripe_checkout_session_id)
					WHERE stripe_checkout_session_id IS NOT NULL
			`).Error
		},
	},
	{
		ID:          "0009_user_profiles",
		Description: "Add display_name, is_public, and avatar_url to users",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`,
				`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false`,
				`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
				`UPDATE users SET display_name = COALESCE(
					NULLIF(TRIM(display_name), ''),
					NULLIF(TRIM(SPLIT_PART(COALESCE(email, ''), '@', 1)), ''),
					'User'
				) WHERE display_name IS NULL OR TRIM(display_name) = ''`,
				`ALTER TABLE users ALTER COLUMN display_name SET NOT NULL`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0010_friends",
		Description: "Create friend_requests and friendships tables",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`CREATE TABLE IF NOT EXISTS friend_requests (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					from_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					to_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					status TEXT NOT NULL DEFAULT 'pending'
						CHECK (status IN ('pending', 'accepted', 'declined')),
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					CHECK (from_user_id <> to_user_id)
				)`,
				`CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_idx
					ON friend_requests (from_user_id, to_user_id) WHERE status = 'pending'`,
				`CREATE INDEX IF NOT EXISTS friend_requests_inbox_idx
					ON friend_requests (to_user_id) WHERE status = 'pending'`,
				`CREATE TABLE IF NOT EXISTS friendships (
					user_a_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					user_b_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					PRIMARY KEY (user_a_id, user_b_id),
					CHECK (user_a_id < user_b_id)
				)`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		ID:          "0011_check_ins",
		Description: "Create check_ins table for office presence",
		Up: func(ctx context.Context, tx *gorm.DB) error {
			statements := []string{
				`CREATE TABLE IF NOT EXISTS check_ins (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
					location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
					check_in_date DATE NOT NULL,
					checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					UNIQUE (user_id, location_id, check_in_date)
				)`,
				`CREATE INDEX IF NOT EXISTS check_ins_location_date_idx
					ON check_ins (location_id, check_in_date)`,
			}
			for _, stmt := range statements {
				if err := tx.WithContext(ctx).Exec(stmt).Error; err != nil {
					return err
				}
			}
			return nil
		},
	},
}

func Run(ctx context.Context, db *gorm.DB) error {
	if err := db.WithContext(ctx).Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			description TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`).Error; err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	for _, migration := range All {
		var count int64
		if err := db.WithContext(ctx).
			Table("schema_migrations").
			Where("id = ?", migration.ID).
			Count(&count).Error; err != nil {
			return fmt.Errorf("check migration %s: %w", migration.ID, err)
		}
		if count > 0 {
			continue
		}

		err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := migration.Up(ctx, tx); err != nil {
				return fmt.Errorf("run migration %s: %w", migration.ID, err)
			}
			if err := tx.WithContext(ctx).Exec(
				`INSERT INTO schema_migrations (id, description) VALUES (?, ?)`,
				migration.ID,
				migration.Description,
			).Error; err != nil {
				return fmt.Errorf("record migration %s: %w", migration.ID, err)
			}
			return nil
		})
		if err != nil {
			return err
		}
	}

	return nil
}
