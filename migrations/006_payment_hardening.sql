ALTER TABLE financial_payments ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS financial_payments_idempotency_idx ON financial_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
