-- C.4: specialist health and education case files.
CREATE TABLE IF NOT EXISTS specialist_cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 domain text NOT NULL CHECK(domain IN ('health','education')),
 service_referral_id uuid NOT NULL REFERENCES service_referrals(id) ON DELETE RESTRICT,
 action_id uuid REFERENCES case_actions(id) ON DELETE SET NULL,
 family_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
 assigned_to uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'new_referral' CHECK(status IN ('new_referral','initial_assessment','appointment_scheduled','in_treatment','assessment','support_plan','follow_up','completed','cancelled')),
 urgency text NOT NULL DEFAULT 'normal' CHECK(urgency IN ('normal','important','urgent','critical')),
 summary text NOT NULL,
 assessment text NOT NULL DEFAULT '',
 provider_name text NOT NULL DEFAULT '',
 center_name text NOT NULL DEFAULT '',
 service_type text NOT NULL DEFAULT '',
 appointment_at timestamptz,
 estimated_cost bigint CHECK(estimated_cost IS NULL OR estimated_cost>=0),
 actual_cost bigint CHECK(actual_cost IS NULL OR actual_cost>=0),
 grade text NOT NULL DEFAULT '',
 school text NOT NULL DEFAULT '',
 academic_year text NOT NULL DEFAULT '',
 education_issue text NOT NULL DEFAULT '',
 education_needs jsonb NOT NULL DEFAULT '{}',
 support_plan text NOT NULL DEFAULT '',
 result text NOT NULL DEFAULT '',
 progress_evaluation text NOT NULL DEFAULT '',
 next_follow_up_at timestamptz,
 created_by uuid REFERENCES users(id),
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(service_referral_id)
);
CREATE INDEX IF NOT EXISTS specialist_cases_assignee_idx ON specialist_cases(assigned_to,domain,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS specialist_cases_family_idx ON specialist_cases(family_id,domain,created_at DESC);
CREATE TABLE IF NOT EXISTS specialist_case_events(
 id bigserial PRIMARY KEY,
 specialist_case_id uuid NOT NULL REFERENCES specialist_cases(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id),
 event text NOT NULL,
 from_status text,
 to_status text,
 note text NOT NULL DEFAULT '',
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS specialist_case_events_case_idx ON specialist_case_events(specialist_case_id,created_at DESC);
CREATE TABLE IF NOT EXISTS specialist_case_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 specialist_case_id uuid NOT NULL REFERENCES specialist_cases(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 document_type text NOT NULL CHECK(document_type IN ('medical_record','prescription','estimate','invoice','education_report','school_document','other')),
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 description text NOT NULL DEFAULT '',
 file_data bytea NOT NULL,
 size_bytes int NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),
 created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS specialist_case_documents_case_idx ON specialist_case_documents(specialist_case_id,created_at DESC);
