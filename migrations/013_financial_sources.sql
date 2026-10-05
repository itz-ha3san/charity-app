-- C.5: connect supervision, actions and specialist cases to finance.
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'direct' CHECK(source_type IN ('direct','weekly_report','action','health_case','education_case'));
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS source_action_id uuid REFERENCES case_actions(id) ON DELETE SET NULL;
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS source_specialist_case_id uuid REFERENCES specialist_cases(id) ON DELETE SET NULL;
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS source_supervision_report_id uuid REFERENCES supervision_reports(id) ON DELETE SET NULL;
ALTER TABLE financial_cases ADD COLUMN IF NOT EXISTS required_approver_position text NOT NULL DEFAULT 'education_deputy' CHECK(required_approver_position IN ('supervision_deputy','health_deputy','education_deputy'));
CREATE UNIQUE INDEX IF NOT EXISTS financial_one_active_per_action_idx ON financial_cases(source_action_id) WHERE source_action_id IS NOT NULL AND status NOT IN ('رد شده','لغو شده');
CREATE UNIQUE INDEX IF NOT EXISTS financial_one_active_per_specialist_idx ON financial_cases(source_specialist_case_id) WHERE source_specialist_case_id IS NOT NULL AND status NOT IN ('رد شده','لغو شده');
CREATE UNIQUE INDEX IF NOT EXISTS financial_one_active_per_report_idx ON financial_cases(source_supervision_report_id) WHERE source_supervision_report_id IS NOT NULL AND status NOT IN ('رد شده','لغو شده');
ALTER TABLE case_actions ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'none' CHECK(financial_status IN ('none','requested','approved','paid'));
ALTER TABLE case_actions ADD COLUMN IF NOT EXISTS financial_case_id uuid REFERENCES financial_cases(id) ON DELETE SET NULL;
ALTER TABLE specialist_cases ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'none' CHECK(financial_status IN ('none','requested','approved','paid'));
ALTER TABLE specialist_cases ADD COLUMN IF NOT EXISTS financial_case_id uuid REFERENCES financial_cases(id) ON DELETE SET NULL;
ALTER TABLE supervision_reports ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'none' CHECK(financial_status IN ('none','requested','approved','paid'));
ALTER TABLE supervision_reports ADD COLUMN IF NOT EXISTS financial_case_id uuid REFERENCES financial_cases(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS financial_case_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 financial_case_id uuid NOT NULL REFERENCES financial_cases(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 document_type text NOT NULL CHECK(document_type IN ('cost_estimate','invoice','supporting_document','other')),
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 description text NOT NULL DEFAULT '',
 file_data bytea NOT NULL,
 size_bytes int NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),
 created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_case_documents_case_idx ON financial_case_documents(financial_case_id,created_at DESC);
