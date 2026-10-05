-- C.10: controlled data migration batches, row validation, provenance and reconciliation.
CREATE TABLE IF NOT EXISTS data_import_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_name text NOT NULL, source_type text NOT NULL CHECK(source_type IN ('excel','csv','json','legacy')),
 source_checksum text NOT NULL, status text NOT NULL DEFAULT 'previewed' CHECK(status IN ('previewed','completed','failed','cancelled')),
 total_rows int NOT NULL DEFAULT 0, valid_rows int NOT NULL DEFAULT 0, invalid_rows int NOT NULL DEFAULT 0, imported_rows int NOT NULL DEFAULT 0,
 summary jsonb NOT NULL DEFAULT '{}', created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), executed_at timestamptz
);
CREATE INDEX IF NOT EXISTS data_import_batches_created_idx ON data_import_batches(created_at DESC);
CREATE TABLE IF NOT EXISTS data_import_rows(
 id bigserial PRIMARY KEY, batch_id uuid NOT NULL REFERENCES data_import_batches(id) ON DELETE CASCADE, row_number int NOT NULL,
 entity_type text NOT NULL CHECK(entity_type IN ('liaison','supervisor','family','member')), source_row jsonb NOT NULL,
 normalized_data jsonb NOT NULL DEFAULT '{}', status text NOT NULL CHECK(status IN ('valid','invalid','imported','skipped')),
 errors jsonb NOT NULL DEFAULT '[]', target_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id,row_number)
);
CREATE INDEX IF NOT EXISTS data_import_rows_batch_idx ON data_import_rows(batch_id,status,row_number);
ALTER TABLE families ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES data_import_batches(id) ON DELETE SET NULL;
ALTER TABLE families ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES data_import_batches(id) ON DELETE SET NULL;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES data_import_batches(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES data_import_batches(id) ON DELETE SET NULL;
