-- C.7: auditable management report exports.
CREATE TABLE IF NOT EXISTS report_exports(
 id bigserial PRIMARY KEY,
 requested_by uuid REFERENCES users(id),
 report_type text NOT NULL CHECK(report_type IN ('monthly','liaison','specialist','family_cost','executive')),
 format text NOT NULL CHECK(format IN ('csv','excel','pdf')),
 filters jsonb NOT NULL DEFAULT '{}',
 row_count int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_exports_user_idx ON report_exports(requested_by,created_at DESC);
