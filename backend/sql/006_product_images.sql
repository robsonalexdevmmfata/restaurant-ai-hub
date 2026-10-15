CREATE TABLE IF NOT EXISTS product_images (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  mime_type VARCHAR(50) NOT NULL CHECK (mime_type = 'image/jpeg'),
  data BYTEA NOT NULL CHECK (octet_length(data) <= 1500000),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_images (
  restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL CHECK (octet_length(data) <= 1000000),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
