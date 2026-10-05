# راهنمای استقرار Production و بازیابی بحران

## پیش‌نیاز
Linux به‌روز، Docker Compose، دامنه، گواهی TLS و فضای Backup خارج از سرور. فایل `.env.production.example` را به `.env.production` کپی و Secretها را با مقادیر مستقل و تصادفی جایگزین کنید. فایل env و گواهی خصوصی نباید وارد Git شوند.

## استقرار
```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -fsS https://YOUR-DOMAIN/health
curl -fsS https://YOUR-DOMAIN/ready
```
سرویس `migrate` قبل از برنامه اجرا می‌شود. ارتقا: ابتدا Backup، سپس Pull/Extract نسخه، Build و `up -d`. برای بازگشت، کد نسخه قبلی را اجرا کنید؛ Migrationهای مخرب ممنوع‌اند و بازگشت دیتابیس فقط از Backup آزمایش‌شده انجام شود.

## Backup روزانه
```bash
BACKUP_ENCRYPTION_KEY='...' BACKUP_OFFSITE_DIR=/mnt/offsite/family-case npm run db:backup:rotate
```
Cron پیشنهادی: هر روز ساعت 02:15. نگهداری پیش‌فرض ۱۴ روز است. چون پیوست‌ها در PostgreSQL ذخیره می‌شوند، Dump رمزگذاری‌شده شامل آن‌ها نیز هست. یک نسخه باید خارج از میزبان اصلی نگهداری شود.

## آزمایش Restore
ماهانه روی دیتابیس و میزبان آزمایشی انجام شود؛ هرگز روی Production آزمایش نکنید. پس از Restore، `/ready`، تعداد خانواده‌ها، آخرین پرداخت و امکان دانلود یک سند نمونه کنترل و نتیجه ثبت شود.

## مانیتورینگ
- عمومی: `/health` و `/ready`
- مدیریتی: `/api/ops/status`
- Prometheus با نشست مدیر: `/api/ops/metrics`
- هشدارها: قطع سرویس، Database down، فضای آزاد کمتر از ۲۰٪، 5xx، افزایش زمان پاسخ، تلاش ورود ناموفق و نبود Backup جدید طی ۲۶ ساعت.
- لاگ‌ها باید به مقصد مرکزی ارسال شوند؛ Cookie، Password و Install Secret در Logger مخفی شده‌اند.

## رخداد و بازیابی
1. سرویس را از Load Balancer خارج کنید.
2. زمان و دامنه رخداد را ثبت کنید.
3. آخرین Backup سالم و Hash آن را تعیین کنید.
4. Restore را ابتدا در محیط جدا آزمایش کنید.
5. DNS/Proxy را پس از Health Check برگردانید.
6. علت، داده ازدست‌رفته و اقدام اصلاحی را مستند کنید.
