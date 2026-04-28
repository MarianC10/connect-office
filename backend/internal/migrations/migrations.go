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
