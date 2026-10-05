ALTER TABLE families ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS families_assigned_to_idx ON families(assigned_to);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS follow_up_status text NOT NULL DEFAULT 'باز';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS notes_due_idx ON notes(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS family_documents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  category text NOT NULL CHECK(category IN ('شناسایی','درمانی','مالی','مسکن','سایر')),
  description text NOT NULL DEFAULT '',
  expires_at date,
  sensitive boolean NOT NULL DEFAULT false,
  file_data bytea NOT NULL,
  size_bytes int NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 8388608),
  replaces_document_id uuid REFERENCES family_documents(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  delete_reason text
);
CREATE INDEX IF NOT EXISTS family_documents_family_idx ON family_documents(family_id,created_at DESC);
