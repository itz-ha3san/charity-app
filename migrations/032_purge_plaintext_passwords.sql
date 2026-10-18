-- Credentials captured by older development builds must not survive an upgrade.
-- Expire affected sessions and require a new password before the account is reused.
UPDATE users SET must_change_password=true
WHERE id IN (SELECT user_id FROM user_password_log);
DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM user_password_log);
DELETE FROM user_password_log;
-- Keep the empty table for compatibility with earlier FK migrations, but never
-- permit a future application version or ad-hoc query to store plaintext again.
ALTER TABLE user_password_log ADD CONSTRAINT user_password_log_capture_disabled CHECK (false);
