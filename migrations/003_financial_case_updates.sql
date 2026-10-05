ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS financial_cases_family_created_idx ON financial_cases(family_id,created_at DESC);
