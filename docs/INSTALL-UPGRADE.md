# نصب، ارتقا و Rollback

## توسعه
`npm install`، `docker compose up -d postgres`، `npm run migrate`، `npm run verify`.

## Production
`.env.production` و TLS را آماده، `docker compose ... build` و سپس `up -d` اجرا کنید. خروجی `ps -a` باید Postgres/App سالم و Migrate با کد صفر باشد. `/health` و `/ready` را بررسی کنید.

## ارتقا
قبل از ارتقا Backup رمزگذاری‌شده بگیرید، نسخه را Extract، Build و Migrate کنید و Smoke Test انجام دهید. Migrationها افزایشی‌اند. برای Rollback ابتدا نسخه قبلی برنامه را اجرا کنید؛ بازگشت دیتابیس فقط با برنامه مصوب و Backup آزمایش‌شده انجام شود. هرگز `down -v` را روی Production اجرا نکنید.
