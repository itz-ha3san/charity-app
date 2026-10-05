-- C.6: in-app alerts, thresholds and per-user state.
CREATE TABLE IF NOT EXISTS alert_settings(
 id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1),
 action_due_soon_days int NOT NULL DEFAULT 3 CHECK(action_due_soon_days BETWEEN 1 AND 30),
 referral_no_response_hours int NOT NULL DEFAULT 48 CHECK(referral_no_response_hours BETWEEN 1 AND 720),
 finance_stale_days int NOT NULL DEFAULT 3 CHECK(finance_stale_days BETWEEN 1 AND 30),
 budget_warning_percent int NOT NULL DEFAULT 20 CHECK(budget_warning_percent BETWEEN 1 AND 99),
 budget_critical_percent int NOT NULL DEFAULT 5 CHECK(budget_critical_percent BETWEEN 0 AND 98),
 document_expiry_days int NOT NULL DEFAULT 7 CHECK(document_expiry_days BETWEEN 1 AND 90),
 updated_by uuid REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(budget_critical_percent<budget_warning_percent)
);
INSERT INTO alert_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS user_alert_states(
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 alert_key text NOT NULL,
 read_at timestamptz,
 dismissed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,alert_key)
);
CREATE INDEX IF NOT EXISTS user_alert_states_active_idx ON user_alert_states(user_id,dismissed_at,read_at);
