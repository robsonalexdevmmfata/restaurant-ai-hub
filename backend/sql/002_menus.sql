-- Fase 4: múltiplos cardápios por restaurante (SaaS multi-tenant)

CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  ai_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_menus_restaurant ON menus(restaurant_id);

-- Produtos passam a pertencer a um cardápio
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_products_menu ON products(menu_id);

-- Migra produtos existentes para um cardápio "Principal" por restaurante
INSERT INTO menus (restaurant_id, name, slug, is_active)
SELECT r.id, 'Cardápio principal', 'principal', TRUE
FROM restaurants r
WHERE NOT EXISTS (SELECT 1 FROM menus m WHERE m.restaurant_id = r.id);

UPDATE products p
SET menu_id = m.id
FROM menus m
WHERE p.menu_id IS NULL
  AND m.restaurant_id = p.restaurant_id
  AND m.slug = 'principal';
