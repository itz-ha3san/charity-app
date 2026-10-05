-- Action priority and direct/note-originated actions.
ALTER TABLE case_actions ALTER COLUMN supervision_report_id DROP NOT NULL;
ALTER TABLE case_actions
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK(priority IN ('low','medium','high','urgent'));
ALTER TABLE case_actions
  ADD COLUMN IF NOT EXISTS source_note_id uuid REFERENCES notes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS case_actions_priority_idx
  ON case_actions(family_id, priority, status, due_at);
CREATE INDEX IF NOT EXISTS case_actions_source_note_idx
  ON case_actions(source_note_id) WHERE source_note_id IS NOT NULL;