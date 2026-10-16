ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(30) NOT NULL DEFAULT 'Essencial',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) NOT NULL DEFAULT 'simulado';
