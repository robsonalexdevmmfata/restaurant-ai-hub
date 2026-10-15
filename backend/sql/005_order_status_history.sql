CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  operator_id INTEGER,
  operator_label VARCHAR(255),
  source VARCHAR(40) NOT NULL,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_changed_at_idx
  ON order_status_history(order_id, changed_at, id);

INSERT INTO order_status_history (
  restaurant_id,
  order_id,
  previous_status,
  new_status,
  source,
  reason
)
SELECT
  restaurant_id,
  id,
  NULL,
  status,
  'migration_snapshot',
  'Estado existente na implantação do histórico; transições anteriores não estavam registradas.'
FROM orders
WHERE NOT EXISTS (
  SELECT 1
  FROM order_status_history history
  WHERE history.order_id = orders.id
);
