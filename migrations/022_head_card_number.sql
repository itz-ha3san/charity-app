-- Monthly-support destination card for the family head.
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS head_card_number text
  CHECK (head_card_number IS NULL OR head_card_number = '' OR head_card_number ~ '^\d{16}$');
