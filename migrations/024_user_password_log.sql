-- Dev/test-only credential capture used by the admin "users registry" screen.
-- Passwords are one-way hashed in users.password_hash, so the original value
-- cannot be recovered. When DEV_CAPTURE_PASSWORDS=true the API additionally
-- records the password submitted at creation / admin-reset time here.
-- The lookup query is scoped to created_by_user_id = the deleting admin.
CREATE TABLE IF NOT EXISTS user_password_log(
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_plain text NOT NULL,
  set_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
