ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS monthly_income bigint NOT NULL DEFAULT 0
  CHECK (monthly_income >= 0);
