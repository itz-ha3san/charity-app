ALTER TABLE financial_payments ADD COLUMN IF NOT EXISTS idempotency_request_hash text;
ALTER TABLE fund_budgets DROP CONSTRAINT IF EXISTS fund_budgets_jalali_year_check;
ALTER TABLE fund_budgets ADD CONSTRAINT fund_budgets_jalali_year_check CHECK(jalali_year>=1300);
ALTER TABLE financial_payments DROP CONSTRAINT IF EXISTS financial_payments_jalali_year_check;
ALTER TABLE financial_payments ADD CONSTRAINT financial_payments_jalali_year_check CHECK(jalali_year>=1300);
