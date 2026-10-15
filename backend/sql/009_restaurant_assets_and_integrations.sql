ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS public_policy TEXT;

CREATE TABLE IF NOT EXISTS restaurant_assets (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('cover', 'favicon', 'promotion')),
  title VARCHAR(120),
  description VARCHAR(280),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL CHECK (octet_length(data) <= 1000000),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_assets_single_branding_kind
  ON restaurant_assets (restaurant_id, kind)
  WHERE kind IN ('cover', 'favicon');

CREATE INDEX IF NOT EXISTS restaurant_assets_promotions_order
  ON restaurant_assets (restaurant_id, sort_order, created_at)
  WHERE kind = 'promotion' AND is_active = TRUE;
