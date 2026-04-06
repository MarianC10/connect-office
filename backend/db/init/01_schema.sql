CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE amenity_category AS ENUM (
    'workspace',
    'connectivity',
    'wellness',
    'food_beverage',
    'accessibility',
    'parking',
    'other'
);

CREATE TABLE locations (
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
);

CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category amenity_category NOT NULL,
    UNIQUE (name, category)
);

CREATE TABLE location_amenities (
    location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities (id) ON DELETE CASCADE,
    PRIMARY KEY (location_id, amenity_id)
);

CREATE INDEX location_amenities_location_id_idx ON location_amenities (location_id);
