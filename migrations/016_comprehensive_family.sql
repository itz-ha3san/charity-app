-- C.8: family tags and comprehensive-file indexes.
CREATE TABLE IF NOT EXISTS family_tag_definitions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text UNIQUE NOT NULL,
 color text NOT NULL DEFAULT 'blue' CHECK(color IN ('gray','blue','green','yellow','orange','red','purple','pink')),
 active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_tag_assignments(
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 tag_id uuid NOT NULL REFERENCES family_tag_definitions(id) ON DELETE CASCADE,
 assigned_by uuid REFERENCES users(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(family_id,tag_id)
);
CREATE INDEX IF NOT EXISTS family_tag_assignments_tag_idx ON family_tag_assignments(tag_id,family_id);
CREATE INDEX IF NOT EXISTS families_priority_active_idx ON families(priority,updated_at DESC) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS notes_family_followup_idx ON notes(family_id,next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
