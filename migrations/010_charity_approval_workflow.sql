-- C.3: charity approval workflow requested for CEO, education/health deputies and liaisons.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_position_check;
ALTER TABLE users ADD CONSTRAINT users_position_check CHECK(position IN ('ceo','supervision_deputy','finance_deputy','finance_officer','health_officer','education_officer','health_deputy','education_deputy','liaison','viewer'));

ALTER TABLE families ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected','cancelled'));
ALTER TABLE families ADD COLUMN IF NOT EXISTS approval_note text NOT NULL DEFAULT '';
ALTER TABLE families ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE families ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS family_change_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL REFERENCES users(id), proposed_data jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 review_note text NOT NULL DEFAULT '', reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS family_one_pending_change_idx ON family_change_requests(family_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS family_change_review_idx ON family_change_requests(status,created_at);

ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'ad_hoc' CHECK(request_type IN ('ad_hoc','monthly'));
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS approved_amount bigint CHECK(approved_amount IS NULL OR approved_amount > 0);
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS decision_note text NOT NULL DEFAULT '';
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id);
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS assigned_reviewer_position text NOT NULL DEFAULT 'education_deputy';
CREATE TABLE IF NOT EXISTS financial_case_events(
 id bigserial PRIMARY KEY, financial_case_id uuid NOT NULL REFERENCES financial_cases(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id),
 action text NOT NULL, from_status text, to_status text, note text NOT NULL DEFAULT '', amount bigint,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_case_events_history_idx ON financial_case_events(family_id,created_at DESC);
