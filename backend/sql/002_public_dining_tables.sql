ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug VARCHAR(160);

WITH normalized AS (
  SELECT
    id,
    trim(both '-' from regexp_replace(
      translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', '-', 'g'
    )) AS candidate
  FROM restaurants
), ranked AS (
  SELECT id, candidate, count(*) OVER (PARTITION BY candidate) AS duplicates
  FROM normalized
)
UPDATE restaurants AS target
SET slug = CASE WHEN ranked.duplicates > 1 THEN ranked.candidate || '-' || target.id ELSE ranked.candidate END
FROM ranked
WHERE target.id = ranked.id AND target.slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_unique ON restaurants(slug);
ALTER TABLE restaurants ALTER COLUMN slug SET NOT NULL;

CREATE TABLE IF NOT EXISTS dining_tables (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL CHECK (table_number > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Livre',
  session_id VARCHAR(64),
  opened_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dining_tables_restaurant_table_unique UNIQUE (restaurant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_restaurant ON dining_tables(restaurant_id, table_number);
