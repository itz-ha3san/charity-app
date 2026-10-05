-- C.13: training acknowledgements and auditable handover checklist.
CREATE TABLE IF NOT EXISTS training_acknowledgements(
 id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 module_code text NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,module_code)
);
CREATE TABLE IF NOT EXISTS handover_checklist_items(
 item_code text PRIMARY KEY, title text NOT NULL, required boolean NOT NULL DEFAULT true,
 completed boolean NOT NULL DEFAULT false, completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 completed_at timestamptz, evidence_note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO handover_checklist_items(item_code,title)VALUES
 ('production_health','Health و Ready در Production تأیید شده است'),
 ('backup_restore','Backup رمزگذاری‌شده و Restore آزمایشی تأیید شده است'),
 ('admin_training','آموزش مدیر سیستم تکمیل شده است'),
 ('role_training','آموزش نقش‌های عملیاتی تکمیل شده است'),
 ('data_migration','مهاجرت آزمایشی و گزارش تطبیق تأیید شده است'),
 ('uat_signoff','UAT و تأیید Release Candidate تکمیل شده است'),
 ('secrets_handover','Secretها از کانال امن تحویل شده‌اند'),
 ('support_contacts','مسئول پشتیبانی و مسیر Escalation مشخص شده است')
ON CONFLICT(item_code)DO NOTHING;
