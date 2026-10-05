# ساختار دیتابیس

PostgreSQL منبع حقیقت است. Migrationها به‌ترتیب عددی و فقط یک‌بار اجرا می‌شوند. هسته: users/sessions، families/members، supervisors/assignments، supervision_reports، case_actions، specialist_cases، financial_cases/payments/funds، documents، alerts، comprehensive tags، security/access logs، import batches، UAT و training/handover. `audit_logs`، `security_events` و `sensitive_access_logs` Append-only هستند. ارتباط‌های خانواده دارای Foreign Key و عملیات مالی دارای Lock/Idempotency است. تغییر دستی Schema در Production ممنوع است.
