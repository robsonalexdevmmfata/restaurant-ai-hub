-- Fase SaaS: perfil do restaurante, usuários com nome, mesas, sessões de mesa e pedidos ricos

/* ---------- Restaurante ---------- */
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(30);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS state VARCHAR(60);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kind VARCHAR(60);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE restaurants
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || id
WHERE slug IS NULL;

ALTER TABLE restaurants ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_key ON restaurants(slug);

/* ---------- Usuários ---------- */
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
-- roles: owner | caixa | cozinha | delivery | superadmin

/* ---------- Produtos ---------- */
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

/* ---------- Mesas ---------- */
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, label)
);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);

/* ---------- Sessões de mesa (abertura/fechamento) ---------- */
CREATE TABLE IF NOT EXISTS table_sessions (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
  payment_method VARCHAR(30),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_restaurant ON table_sessions(restaurant_id, status);

/* ---------- Pedidos ---------- */
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'ia';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_json JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ALTER COLUMN customer_phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
