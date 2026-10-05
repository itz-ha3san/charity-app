-- C.11: user acceptance testing cycles, role scenarios, results and prioritized feedback.
CREATE TABLE IF NOT EXISTS uat_cycles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, target_version text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed','release_candidate')),
 starts_at timestamptz, ends_at timestamptz, release_candidate_version text,
 created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS uat_scenarios(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cycle_id uuid NOT NULL REFERENCES uat_cycles(id) ON DELETE CASCADE,
 code text NOT NULL, position text NOT NULL, title text NOT NULL, steps jsonb NOT NULL DEFAULT '[]', expected_result text NOT NULL,
 priority text NOT NULL DEFAULT 'high' CHECK(priority IN ('low','normal','high','critical')), required boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(cycle_id,code)
);
CREATE INDEX IF NOT EXISTS uat_scenarios_cycle_position_idx ON uat_scenarios(cycle_id,position);
CREATE TABLE IF NOT EXISTS uat_results(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scenario_id uuid NOT NULL REFERENCES uat_scenarios(id) ON DELETE CASCADE,
 tester_id uuid NOT NULL REFERENCES users(id), status text NOT NULL CHECK(status IN ('passed','failed','blocked')),
 notes text NOT NULL DEFAULT '', evidence jsonb NOT NULL DEFAULT '{}', tested_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(scenario_id,tester_id)
);
CREATE TABLE IF NOT EXISTS uat_feedback(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cycle_id uuid NOT NULL REFERENCES uat_cycles(id) ON DELETE CASCADE,
 scenario_id uuid REFERENCES uat_scenarios(id) ON DELETE SET NULL, reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('defect','improvement','ux','training')),
 severity text NOT NULL CHECK(severity IN ('low','normal','high','critical')), title text NOT NULL, description text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','fixed','deferred','closed')),
 priority_rank int, resolution_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uat_feedback_cycle_status_idx ON uat_feedback(cycle_id,status,severity,created_at DESC);
