-- C.9: security hardening, sensitive-access accountability and privacy policy.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count int NOT NULL DEFAULT 0 CHECK(failed_login_count>=0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS security_events(
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 username text, event_type text NOT NULL, severity text NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','critical')),
 ip_address text, user_agent text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_actor_idx ON security_events(actor_id,created_at DESC);
CREATE OR REPLACE FUNCTION deny_security_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'security_events is append-only'; END $$;
DROP TRIGGER IF EXISTS security_events_no_update ON security_events;
CREATE TRIGGER security_events_no_update BEFORE UPDATE OR DELETE ON security_events FOR EACH ROW EXECUTE FUNCTION deny_security_event_mutation();

CREATE TABLE IF NOT EXISTS sensitive_access_logs(
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 family_id uuid REFERENCES families(id) ON DELETE SET NULL, resource_type text NOT NULL,
 resource_id uuid NOT NULL, action text NOT NULL CHECK(action IN ('view','download')),
 access_reason text NOT NULL CHECK(length(trim(access_reason))>=3), ip_address text, user_agent text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sensitive_access_created_idx ON sensitive_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS sensitive_access_family_idx ON sensitive_access_logs(family_id,created_at DESC);
CREATE OR REPLACE FUNCTION deny_sensitive_access_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'sensitive_access_logs is append-only'; END $$;
DROP TRIGGER IF EXISTS sensitive_access_no_update ON sensitive_access_logs;
CREATE TRIGGER sensitive_access_no_update BEFORE UPDATE OR DELETE ON sensitive_access_logs FOR EACH ROW EXECUTE FUNCTION deny_sensitive_access_mutation();

CREATE TABLE IF NOT EXISTS data_retention_policy(
 id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1), session_days int NOT NULL DEFAULT 30 CHECK(session_days BETWEEN 1 AND 365),
 security_event_days int NOT NULL DEFAULT 730 CHECK(security_event_days BETWEEN 90 AND 3650),
 deleted_document_days int NOT NULL DEFAULT 365 CHECK(deleted_document_days BETWEEN 30 AND 3650),
 backup_encryption_required boolean NOT NULL DEFAULT true, updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO data_retention_policy(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

ALTER TABLE family_documents ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE family_documents ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'legacy' CHECK(scan_status IN ('legacy','clean','rejected'));
ALTER TABLE specialist_case_documents ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE specialist_case_documents ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'legacy' CHECK(scan_status IN ('legacy','clean','rejected'));
ALTER TABLE financial_case_documents ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE financial_case_documents ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'legacy' CHECK(scan_status IN ('legacy','clean','rejected'));
ALTER TABLE financial_payments ADD COLUMN IF NOT EXISTS receipt_sha256 text;
ALTER TABLE financial_payments ADD COLUMN IF NOT EXISTS receipt_scan_status text NOT NULL DEFAULT 'legacy' CHECK(receipt_scan_status IN ('legacy','clean','rejected'));
