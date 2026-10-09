-- Internal, auditable messages from leadership to charity liaisons.
CREATE TABLE IF NOT EXISTS liaison_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_position text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 2 AND 180),
  body text NOT NULL CHECK (length(body) BETWEEN 3 AND 5000),
  severity text NOT NULL DEFAULT 'important'
    CHECK (severity IN ('important','urgent','critical')),
  acknowledgement_required boolean NOT NULL DEFAULT false,
  family_id uuid REFERENCES families(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liaison_message_recipients (
  message_id uuid NOT NULL REFERENCES liaison_messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz,
  acknowledged_at timestamptz,
  PRIMARY KEY (message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS liaison_message_recipients_unread_idx
  ON liaison_message_recipients(recipient_id, read_at, message_id);
CREATE INDEX IF NOT EXISTS liaison_messages_created_idx
  ON liaison_messages(created_at DESC);