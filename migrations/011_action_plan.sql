-- C.3: action plan, assignment, completion declaration and result approval.
CREATE TABLE IF NOT EXISTS case_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 supervision_report_id uuid NOT NULL REFERENCES supervision_reports(id) ON DELETE CASCADE,
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 domain text NOT NULL DEFAULT 'general' CHECK(domain IN ('general','health','education')),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','assigned','completed','revision_requested','approved','cancelled')),
 proposed_by uuid NOT NULL REFERENCES users(id),
 assigned_to uuid REFERENCES users(id),
 assigned_by uuid REFERENCES users(id),
 due_at date,
 assignment_note text NOT NULL DEFAULT '',
 completion_note text NOT NULL DEFAULT '',
 completed_at timestamptz,
 review_note text NOT NULL DEFAULT '',
 reviewed_by uuid REFERENCES users(id),
 reviewed_at timestamptz,
 service_referral_id uuid REFERENCES service_referrals(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_actions_family_idx ON case_actions(family_id,created_at DESC);
CREATE INDEX IF NOT EXISTS case_actions_assignee_idx ON case_actions(assigned_to,status,due_at);
CREATE INDEX IF NOT EXISTS case_actions_review_idx ON case_actions(status,created_at) WHERE status IN ('proposed','completed');
CREATE TABLE IF NOT EXISTS case_action_events(
 id bigserial PRIMARY KEY,
 action_id uuid NOT NULL REFERENCES case_actions(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id),
 event text NOT NULL,
 from_status text,
 to_status text,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_action_events_family_idx ON case_action_events(family_id,created_at DESC);
