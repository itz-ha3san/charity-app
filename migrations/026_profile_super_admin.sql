-- Grant audit access only to the oldest existing active administrator (installation owner).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
UPDATE users SET is_super_admin=true WHERE id=(SELECT id FROM users WHERE role='admin' AND active ORDER BY created_at,id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM users WHERE is_super_admin);
CREATE INDEX IF NOT EXISTS supervisors_search_name_idx ON supervisors(name);
