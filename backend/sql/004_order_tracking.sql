ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_unique
  ON orders (tracking_token);
