ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood VARCHAR(120),
  ADD COLUMN IF NOT EXISTS delivery_postal_code VARCHAR(12);

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS delivery_assignments (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DISPONIVEL'
    CHECK (status IN ('DISPONIVEL', 'EM_ROTA', 'ENTREGUE')),
  assigned_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS delivery_assignments_restaurant_status_idx
  ON delivery_assignments(restaurant_id, status, updated_at);

CREATE TABLE IF NOT EXISTS delivery_assignment_history (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('DISPONIVEL', 'EM_ROTA', 'ENTREGUE')),
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_assignment_history_order_idx
  ON delivery_assignment_history(order_id, occurred_at, id);

INSERT INTO delivery_assignments (order_id, restaurant_id)
SELECT id, restaurant_id
FROM orders
WHERE source = 'delivery'
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO delivery_assignment_history (restaurant_id, order_id, driver_id, status)
SELECT assignment.restaurant_id, assignment.order_id, assignment.driver_id, assignment.status
FROM delivery_assignments assignment
WHERE NOT EXISTS (
  SELECT 1
  FROM delivery_assignment_history history
  WHERE history.order_id = assignment.order_id
);
