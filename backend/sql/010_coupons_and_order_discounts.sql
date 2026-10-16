CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('percentual', 'valor-fixo', 'frete-gratis')),
  value NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 0 CHECK (max_uses >= 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coupons_date_range_valid CHECK (expires_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_restaurant_code_unique
  ON coupons (restaurant_id, code);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10, 2) NOT NULL DEFAULT 0;
