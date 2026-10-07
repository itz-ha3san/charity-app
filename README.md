# سامانه پرونده خانوارها — Full-stack v20.0.9 — C.14 Future Extensions

Backend واقعی برای مدیریت پرونده خانوار، پیگیری، اسناد، کاربران و گردش مالی مؤسسه خیریه.

## معماری

- Node.js 22+ و TypeScript
- Fastify و Zod
- PostgreSQL 16
- Argon2id و Session Cookie از نوع HttpOnly/SameSite
- RBAC، Transaction و Audit Log تغییرناپذیر
- Testcontainers و Fastify.inject برای Integration Test

معماری قدیمی Express مبنای این پروژه نیست.

راهنمای اصلاحات جدید و نصب: [UPDATE-2026-10-07-FA.md](UPDATE-2026-10-07-FA.md)

## نقش‌ها

- **سوپرادمین:** حساب مالک نصب با دسترسی Audit؛ مدیر عادی این دسترسی را ندارد.
- **مدیر:** مدیریت پرونده، کاربران، صندوق، بودجه و تأیید؛ بدون دسترسی Audit
- **مددکار:** ایجاد/ویرایش پرونده، یادداشت، اسناد مجاز و ارسال درخواست برای بررسی
- **حسابدار:** مشاهده پرونده و ثبت پرداخت ارجاع‌شده
- **مشاهده‌گر:** دسترسی فقط‌خواندنی بدون اسناد حساس

مجوزها فقط در UI نیستند و در Backend کنترل می‌شوند.

## گردش مالی

```text
درخواست جدید → در بررسی → تأیید شده → ارجاع به حسابدار → پرداخت شده
                         ↘ رد شده
```

Transition نامعتبر با `409 INVALID_FINANCIAL_TRANSITION` و نقش نامجاز با `403 FORBIDDEN` رد می‌شود. پرداخت فقط از وضعیت «ارجاع به حسابدار» مجاز است.

### قرارداد پول

مبالغ در PostgreSQL از نوع `bigint` و در پاسخ API رشته ده‌دهی هستند:

```json
{"amount":"60000000","remaining":"40000000"}
```

Backend و Frontend برای محاسبات مالی از Float استفاده نمی‌کنند.

### هم‌زمانی و Idempotency

پرداخت ابتدا درخواست مالی را با `FOR UPDATE` قفل و سپس صندوق/دوره را با Advisory Lock سریال می‌کند. مجموع پرداخت‌ها نمی‌تواند از بودجه عبور کند.

هدر اختیاری:

```http
Idempotency-Key: unique-client-key
```

- اولین درخواست: `201`
- تکرار همان Key و Payload: همان پاسخ `201` همراه `Idempotency-Replayed: true`
- همان Key با Payload متفاوت: `409 IDEMPOTENCY_KEY_REUSED`

## ارقام و تاریخ

ارقام فارسی و عربی در کد ملی، تلفن، شماره پرونده، مبلغ، دوره مالی و شماره پیگیری پیش از Validation به ASCII تبدیل می‌شوند. تاریخ واقعی در `date/timestamptz` ذخیره می‌شود؛ سال و ماه شمسی فقط برای دوره بودجه و گزارش است و سقف ثابت ۱۵۰۰ حذف شده است.

## اسناد

PDF/JPEG/PNG/WebP تا ۸ مگابایت، سند حساس، Soft Delete، Replace و Audit پشتیبانی می‌شود. سند حساس فقط برای مدیر یا مددکار مسئول قابل دسترسی است. پرونده آرشیوشده خواندنی است اما سند آن قابل بارگذاری، حذف یا جایگزینی نیست.

## نصب Development

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run migrate
npm run dev
```

تنظیمات پورت محلی خود را در `.env` و `docker-compose.yml` نگه دارید.

## Production Bootstrap

در Production مقدار تصادفی حداقل ۱۶ نویسه‌ای الزامی است:

```env
BOOTSTRAP_SECRET=replace-with-a-long-random-secret
COOKIE_SECURE=true
```

اولین مدیر علاوه بر نام کاربری و رمز باید کلید نصب را وارد کند. پس از ایجاد اولین کاربر، Bootstrap دوم با `409` رد می‌شود. Login و Bootstrap دارای Rate Limit پایه هستند.

## Health Contract

- `GET /health`: فقط زنده‌بودن Process
- `GET /ready`: آمادگی برنامه و دسترسی PostgreSQL با timeout

## تست‌ها

Docker باید فعال باشد. تست‌ها PostgreSQL موقت با پورت تصادفی می‌سازند و دیتابیس Development را تغییر نمی‌دهند.

```bash
npm run typecheck
npm run test:integration
npm run verify
```

پوشش تست شامل Authentication، Logout، Session، نقش‌ها، چرخه پرونده، آرشیو، State Machine مالی، Reject، بودجه، هم‌زمانی، Idempotency، رسید، اسناد حساس و تغییرناپذیری Audit است.

## Backup و Restore

```bash
npm run db:backup -- backup.dump
npm run db:restore -- backup.dump
```

Restore مخرب است و باید ابتدا روی محیط آزمایشی اجرا شود. فایل Dump شامل داده حساس است و نباید وارد Git یا فضای عمومی شود.

## APIهای اصلی

- `/auth/status`, `/auth/bootstrap`, `/auth/login`, `/auth/me`, `/auth/logout`
- `/api/families`
- `/api/families/:id/financial-cases`
- `/api/financial-cases/:id/transition`
- `/api/financial-cases/:id/pay`
- `/api/funds` و بودجه ماهانه
- `/api/families/:id/documents`
- `/api/users`, `/api/sessions`
- `/api/dashboard`, `/api/reports/export`

در Production از HTTPS، مدیریت Secrets، Backup زمان‌بندی‌شده، مانیتورینگ و Object Storage برای رشد حجم فایل‌ها استفاده کنید.


## C.1 — ساختار سازمانی و Scope دسترسی

مدل مصوب سازمانی:

```text
معاونت سرپرستی → رابط → سرپرست → خانواده‌ها
```

- سرپرست حساب کاربری ندارد و توسط رابط مدیریت می‌شود.
- هر سرپرست دقیقاً یک رابط دارد.
- هر خانواده فقط یک سرپرست فعال دارد؛ تاریخچه تغییر سرپرست حفظ می‌شود.
- خانواده بدون سرپرست موقتاً فقط برای ایجادکننده و مدیران قابل مشاهده است.
- مسئول درمان و مسئول آموزش فقط خانواده‌های ارجاع‌شده و فعال خود را می‌بینند.
- با تکمیل یا لغو ارجاع، دسترسی تخصصی آن خانواده پایان می‌یابد.
- مدیرعامل و معاون سرپرستی دسترسی سازمانی دارند؛ مالی طبق مجوز مالی دسترسی خواندنی دارد.

### سمت‌های سازمانی

`ceo`, `supervision_deputy`, `finance_deputy`, `finance_officer`, `health_officer`, `education_officer`, `liaison`, `viewer`

سمت سازمانی از Role فنی جداست. Role مجوز پایه و Position دامنه کاری را تعیین می‌کند.

### APIهای جدید

- `GET /api/organization/overview`
- `POST/PATCH /api/supervisors`
- `POST /api/families/:id/supervisor`
- `GET /api/families/:id/team`
- `POST /api/families/:id/referrals`
- `GET /api/referrals/mine`
- `PATCH /api/referrals/:id`

Migration شماره `008_organization_scope.sql` باید با `npm run migrate` اعمال شود.


### v7.0.1
برای سازگاری با داده‌های قبل از C.1، رابطی که در فیلد قدیمی `families.assigned_to` مسئول پرونده بوده تا زمان انتقال به ساختار جدید دسترسی خود را حفظ می‌کند. Node.js 22.22 یا جدیدتر برای Testcontainers 12 الزامی است.


## C.2 — گزارش هفتگی غیرمستقیم و کارتابل سرپرستی

قرارداد عملیاتی مصوب:

```text
رابط ← تماس هفتگی با سرپرست ← گزارش هر خانواده ← تأیید معاون سرپرستی
```

- گزارش برای هر خانواده و هفته یکتا است.
- ارتباط از طریق تلفن، پیام یا دیدار با سرپرست ثبت می‌شود.
- چک‌لیست شامل موفقیت تماس، تغییر مسکن و درآمد، نگرانی درمانی/آموزشی و نیاز فوری است.
- اولویت به‌صورت دستی تعیین می‌شود.
- گزارش ابتدا Draft و سپس Submitted است؛ همه گزارش‌ها نیازمند تأیید معاون سرپرستی هستند.
- معاون می‌تواند تأیید یا با توضیح درخواست اصلاح کند.
- پس از تأیید، موعد بعدی بر اساس دوره پیش‌فرض هفت‌روزه محاسبه می‌شود.
- کارتابل رابط، خانواده‌های سررسیدشده؛ و کارتابل معاون، گزارش‌های منتظر تأیید و موارد عقب‌افتاده را نشان می‌دهد.

APIهای جدید:

- `GET /api/supervision/inbox`
- `GET /api/families/:id/supervision-reports`
- `PUT /api/families/:id/supervision-plan`
- `POST /api/families/:id/supervision-reports`
- `PATCH /api/supervision-reports/:id`
- `POST /api/supervision-reports/:id/submit`
- `POST /api/supervision-reports/:id/review`

Migration شماره `009_weekly_supervision.sql` باید اجرا شود.

## گردش تأیید مالی و تغییرات خانواده

- مدیرعامل (برای نمونه «امین نبئی») دسترسی کامل دارد و می‌تواند درخواست‌ها را تأیید، رد یا لغو کند.
- سمت‌های `education_deputy` (معاون آموزشی؛ برای نمونه «علیرضا») و `health_deputy` به همه پرونده‌های خانواده دسترسی دارند و مجاز به بررسی درخواست‌ها هستند.
- رابط درخواست «موردی» یا «ماهانه» را با دسته‌بندی‌های مصوب ثبت می‌کند.
- مبلغ تأییدشده می‌تواند کمتر از مبلغ درخواستی باشد و ثبت نظر برای معاونان الزامی است.
- فقط مدیرعامل یا معاون آموزشی درخواست تأییدشده را به مرحله واریز می‌برد؛ ثبت پرداخت آن را «پرداخت شده» می‌کند.
- تمام ایجادها، تصمیم‌ها، لغوها و پرداخت‌ها در `financial_case_events` و Audit خانواده ثبت می‌شوند.
- ایجاد خانواده توسط رابط با وضعیت `pending` انجام می‌شود و ویرایش رابط در `family_change_requests` تا تأیید سطح بالاتر روی پرونده اعمال نمی‌شود.
- کارتابل بررسی: `GET /api/approvals/families`؛ بررسی ایجاد: `POST /api/families/:id/review`؛ بررسی ویرایش: `POST /api/family-change-requests/:id/review`.

حساب کاربران نام‌برده به‌دلیل نیاز به رمز امن خودکار ساخته نمی‌شود؛ مدیر اولیه را با نام نمایشی امین نبئی Bootstrap و کاربر علیرضا را از مدیریت کاربران با سمت معاون آموزشی ایجاد کنید.


## C.3 — برنامه اقدام و تأیید نتیجه

گردش عملیاتی تثبیت‌شده:

```text
گزارش هفتگی تأییدشده → پیشنهاد اقدام توسط رابط → تخصیص مسئول و مهلت توسط معاون
→ اعلام انجام توسط مسئول → تأیید نتیجه یا درخواست اصلاح توسط معاون → بسته‌شدن اقدام
```

- اقدام فقط از گزارش هفتگی تأییدشده ساخته می‌شود.
- حوزه اقدام `general`، `health` یا `education` است.
- اقدام درمانی فقط به `health_officer` و اقدام آموزشی فقط به `education_officer` تخصیص می‌یابد.
- تخصیص تخصصی، ارجاع فعال ایجاد می‌کند و دسترسی مسئول را به همان خانواده می‌دهد.
- با تأیید نتیجه یا لغو اقدام، ارجاع بسته و دسترسی ناشی از آن قطع می‌شود.
- تمام انتقال وضعیت‌ها در `case_action_events` و Audit Log خانواده ثبت می‌شوند.
- کارتابل مسئول و معاون، اقدامات فعال، منتظر تأیید و عقب‌افتاده را نمایش می‌دهد.

APIهای C.3:

- `GET /api/actions/inbox`
- `GET /api/families/:id/actions`
- `POST /api/supervision-reports/:reportId/actions`
- `POST /api/actions/:id/assign`
- `POST /api/actions/:id/complete`
- `POST /api/actions/:id/review`
- `POST /api/actions/:id/cancel`

Migration شماره `011_action_plan.sql` باید اجرا شود. مجموعه Integration Test اکنون ۱۷ سناریو دارد؛ سناریوی هفدهم چرخه کامل C.3 و قطع دسترسی تخصصی پس از بسته‌شدن اقدام را پوشش می‌دهد.


## C.4 — پرونده تخصصی درمان و آموزش

### درمان

```text
ارجاع جدید → بررسی اولیه → نوبت‌گذاری → در حال درمان → تکمیل‌شده
```

اطلاعات پرونده شامل فوریت، تشخیص اولیه، پزشک، مرکز درمانی، نوع خدمت، نوبت، هزینه تخمینی و واقعی، نتیجه و پیگیری بعدی است.

### آموزش

```text
ارجاع جدید → ارزیابی → برنامه حمایتی → در حال پیگیری → تکمیل‌شده
```

اطلاعات آموزشی شامل عضو خانواده، پایه، مدرسه، سال تحصیلی، مشکل آموزشی، نیازها، برنامه حمایتی، نتیجه و ارزیابی پیشرفت است.

### دسترسی و اتصال به C.3

- پرونده تخصصی فقط از ارجاع فعال همان حوزه تشکیل می‌شود.
- مسئول درمان یا آموزش فقط پرونده‌های تخصیص‌یافته به خودش را می‌بیند.
- پرونده تخصصی می‌تواند به اقدام C.3 متصل باشد.
- در پرونده متصل، دسترسی تا تأیید نهایی نتیجه اقدام حفظ و سپس قطع می‌شود.
- مدارک پزشکی، نسخه، برآورد، فاکتور و مدارک آموزشی با محدودیت نوع و حجم ۸ مگابایت پشتیبانی می‌شوند.
- مشاهده فایل تخصصی نیز در Audit Log ثبت می‌شود.

APIهای C.4:

- `GET /api/specialist-cases/inbox`
- `GET/POST /api/families/:id/specialist-cases`
- `PATCH /api/specialist-cases/:id`
- `POST /api/specialist-cases/:id/transition`
- `GET/POST /api/specialist-cases/:id/documents`
- `GET /api/specialist-documents/:id/download`

Migration شماره `012_specialist_cases.sql` باید اجرا شود. تست‌های Integration اکنون ۱۹ سناریو دارند و گردش کامل درمان و آموزش، اسناد تخصصی، اتصال به اقدام و قطع دسترسی را پوشش می‌دهند.


## C.5 — اتصال سرپرستی و پرونده تخصصی به امور مالی

```text
نیاز شناسایی‌شده → درخواست مالی → بررسی معاون مربوط → تأیید مبلغ
→ ارجاع به مالی → انتخاب صندوق و بودجه → پرداخت → ثبت رسید و بستن مالی منبع
```

منابع قابل اتصال:

- گزارش هفتگی تأییدشده
- اقدام C.3 تأییدشده
- پرونده درمان تکمیل‌شده
- پرونده آموزش تکمیل‌شده

قواعد اصلی:

- گزارش و اقدام به معاون سرپرستی ارجاع می‌شوند.
- پرونده درمان به معاون بهداشت و درمان ارجاع می‌شود.
- پرونده آموزش به معاون آموزشی ارجاع می‌شود.
- مدیرعامل می‌تواند همه مسیرها را بررسی کند.
- مبلغ تأییدشده می‌تواند کمتر از مبلغ درخواستی باشد.
- درخواست تأییدشده به کارتابل مالی می‌رود و پرداخت فقط از صندوق دارای بودجه انجام می‌شود.
- پرداخت و رسید به اقدام یا پرونده تخصصی منبع متصل می‌شوند.
- برای هر منبع فقط یک درخواست مالی فعال یا پرداخت‌شده مجاز است.
- درخواست رد یا لغوشده اجازه ایجاد درخواست جایگزین می‌دهد.
- برآورد هزینه، فاکتور و مدارک پشتیبان تا ۸ مگابایت قابل پیوست هستند.

APIهای C.5:

- `GET /api/financial-cases/inbox`
- `POST /api/financial-sources/request`
- `GET/POST /api/financial-cases/:id/documents`
- `GET /api/financial-documents/:id/download`
- گردش‌های موجود `transition` و `pay` اکنون منبع و معاون مربوط را نیز کنترل می‌کنند.

Migration شماره `013_financial_sources.sql` باید اجرا شود. تست‌های Integration اکنون ۲۰ سناریو دارند؛ سناریوی C.5 یکتایی درخواست منبع، تأیید جزئی، کنترل معاون مربوط، پیوست برآورد، پرداخت و بسته‌شدن مالی اقدام را پوشش می‌دهد.


## C.6 — هشدارها و پیگیری خودکار

هشدارهای داخل برنامه برای موارد زیر تولید می‌شوند:

- گزارش هفتگی سررسیدشده یا عقب‌افتاده
- گزارش هفتگی منتظر تأیید معاون
- اقدام نزدیک مهلت یا عقب‌افتاده
- نتیجه اقدام منتظر تأیید
- ارجاع درمانی یا آموزشی بدون پاسخ
- بودجه صندوق نزدیک اتمام
- درخواست مالی معطل‌مانده
- سند نزدیک انقضا یا منقضی‌شده
- پیگیری سررسیدشده یا عقب‌افتاده

سطوح هشدار:

```text
اطلاع‌رسانی → مهم → فوری → بحرانی
```

- هشدارها بر اساس نقش و محدوده دسترسی کاربر تولید می‌شوند.
- هر کاربر وضعیت خوانده‌شده و بسته‌شده مستقل دارد.
- مدیرعامل می‌تواند آستانه‌های مهلت اقدام، پاسخ ارجاع، معطلی مالی، بودجه و انقضای سند را تنظیم کند.
- نشان تعداد هشدار خوانده‌نشده و فیلتر سطح در رابط کاربری قرار گرفته است.

APIهای C.6:

- `GET /api/alerts`
- `POST /api/alerts/:key/read`
- `POST /api/alerts/:key/dismiss`
- `GET/PUT /api/alerts/settings`

Migration شماره `014_alerts.sql` باید اجرا شود. تست‌های Integration اکنون ۲۱ سناریو دارند؛ تست C.6 هشدارهای مبتنی بر نقش، موارد عقب‌افتاده، وضعیت خوانده‌شده، بستن هشدار و مجوز تنظیمات را پوشش می‌دهد.


## C.7 — داشبوردهای مدیریتی و گزارش‌ها

### داشبورد مدیرعامل

- خانواده‌های فعال، آرشیوی و منتظر تأیید
- توزیع خانواده‌ها بین رابط‌ها و سرپرست‌ها
- گزارش‌های هفتگی عقب‌افتاده و منتظر تأیید
- اقدامات باز، تأییدشده و عقب‌افتاده
- ارجاعات درمان و آموزش
- درخواست‌ها و پرداخت‌های مالی
- مصرف و مانده بودجه صندوق‌ها
- موارد فوری و بحرانی

### داشبورد معاون سرپرستی

- عملکرد رابط‌ها و سرپرست‌ها
- درصد گزارش‌های به‌موقع و تأییدشده
- گزارش‌ها و نتایج منتظر تأیید
- اقدامات عقب‌افتاده
- خانواده‌های فاقد پیگیری کافی

### داشبورد مالی

- بودجه مصوب، پرداخت‌شده و باقی‌مانده
- پرداخت بر اساس خانواده، دسته و صندوق
- درخواست‌های مالی معطل
- روند پرداخت دوره‌ای
- پیش‌بینی نیاز ماه آینده بر اساس میانگین سه دوره اخیر

### خروجی‌ها

- CSV استاندارد UTF-8
- Excel سازگار با `.xls`
- گزارش HTML مناسب چاپ یا ذخیره به PDF
- گزارش ماهانه مالی
- عملکرد رابط‌ها
- عملکرد واحد درمان و آموزش
- هزینه هر خانواده
- گزارش اجرایی مدیرعامل

تمام خروجی‌ها در `report_exports` و Audit Log ثبت می‌شوند.

APIهای C.7:

- `GET /api/dashboards/ceo`
- `GET /api/dashboards/supervision`
- `GET /api/dashboards/finance`
- `GET /api/reports/management?type=...&format=csv|excel|pdf`

Migration شماره `015_management_reports.sql` باید اجرا شود. تست‌های Integration اکنون ۲۲ سناریو دارند و دسترسی نقش‌ها، داشبوردها، CSV، Excel، نسخه چاپی و ثبت Audit خروجی را پوشش می‌دهند.


## C.8 — پرونده جامع و یکپارچه خانواده

پرونده جامع، اطلاعات زیر را در یک نمای واحد ارائه می‌کند:

- اطلاعات هویتی و اعضای خانواده
- مسکن، اشتغال، تحصیل، درمان و بیمه
- اسناد قابل مشاهده بر اساس سطح دسترسی
- گزارش‌های هفتگی
- برنامه اقدامات C.3
- پرونده‌های تخصصی درمان و آموزش
- درخواست‌ها، تأییدها و پرداخت‌های مالی
- تیم خانواده شامل رابط و سرپرست
- آخرین تماس و نزدیک‌ترین پیگیری بعدی
- جدول زمانی یکپارچه فعالیت‌ها تا ۵۰۰ رویداد

قابلیت‌های تکمیلی:

- جست‌وجوی پیشرفته بر اساس متن، وضعیت، اولویت، رابط، سرپرست، برچسب، وضعیت اقدام، حوزه تخصصی و تاریخ پیگیری
- برچسب‌گذاری خانواده‌ها و فیلتر بر اساس برچسب
- تشخیص اطلاعات ناقص و محاسبه درصد تکمیل پرونده
- مخفی‌ماندن اسناد حساس برای کاربران فاقد مجوز
- چاپ خلاصه پرونده در قالب مناسب A4
- ثبت افزودن و حذف برچسب در Audit Log

APIهای C.8:

- `GET /api/families/search/advanced`
- `GET /api/families/:id/comprehensive`
- `GET /api/families/:id/print`
- `GET/POST /api/family-tags`
- `POST /api/families/:id/tags`
- `DELETE /api/families/:id/tags/:tagId`

Migration شماره `016_comprehensive_family.sql` باید اجرا شود. تست‌های Integration اکنون ۲۳ سناریو دارند و پرونده جامع، Timeline، جست‌وجوی پیشرفته، برچسب، چاپ و محدوده دسترسی را پوشش می‌دهند.


## C.9 — امنیت نهایی و حریم خصوصی

- کنترل Object-level روی دانلود رسید و اسناد، همراه با ثبت دلیل دسترسی برای محتوای حساس، درمانی و مالی
- اعتبارسنجی Magic Byte برای PDF/JPEG/PNG/WebP، رد محتوای اجرایی/HTML، محدودیت ۸ مگابایت و ثبت SHA-256
- سیاست رمز حداقل ۱۲ نویسه شامل حروف بزرگ/کوچک و عدد، تغییر اجباری پس از Reset، قفل پایدار حساب و ابطال فوری نشست
- حذف نشست منقضی، ثبت last-seen، رویدادهای امنیتی و Audit تغییرناپذیر دسترسی حساس
- ثبت before/after برای تغییر نقش، سمت و وضعیت کاربر
- سیاست نگهداری قابل مدیریت با Dry-run؛ Audit و لاگ دسترسی حساس هرگز توسط Retention حذف نمی‌شوند
- Backup رمزگذاری‌شده AES-256-GCM با `BACKUP_ENCRYPTION_KEY` و بررسی Dependency با `npm run security:audit`

APIهای مدیریتی: `/api/security/events`، `/api/security/sensitive-access`، `/api/security/retention-policy` و `/api/security/retention-preview`. Migration شماره `017_security_privacy.sql` باید اجرا شود.


## C.10 — مدیریت داده و مهاجرت اطلاعات

- قالب استاندارد CSV سازگار با Excel برای رابط، سرپرست، خانواده و عضو
- پیش‌نمایش پایدار تا ۵۰۰۰ ردیف، تشخیص کد ملی/شماره پرونده/نام کاربری تکراری و گزارش خطای ردیفی
- اجرای نهایی فقط برای Batch بدون خطا و در یک Transaction
- ایجاد رابط با رمز موقت یک‌بارنمایش و الزام تغییر رمز، اتصال سرپرست به رابط و خانواده به سرپرست
- ثبت منبع و Batch روی داده واردشده، Audit کامل و گزارش تطبیق پس از مهاجرت
- امکان اصلاح فایل و ایجاد Preview جدید بدون دستکاری Batch قبلی

APIها: `/api/data-migration/template`، `/preview`، `/batches/:id/execute`، `/batches` و `/batches/:id/report`. Migration شماره `018_data_migration.sql` باید اجرا شود.


## C.11 — تست پذیرش کاربران (UAT)

- چرخه UAT نسخه‌دار با وضعیت Draft، Active و Release Candidate
- هفت سناریوی پیش‌فرض برای مدیرعامل، معاون سرپرستی، رابط، درمان، آموزش، مالی و گردش سراسری
- نمایش سناریو بر اساس سمت واقعی، ثبت موفق/ناموفق/مسدود و شواهد آزمون
- ثبت اشکال، بهبود، مشکل تجربه کاربری و نیاز آموزشی با شدت و اولویت
- خلاصه مدیریتی پوشش نقش‌ها، سناریوهای الزامی و موارد بحرانی باز
- جلوگیری از ساخت Release Candidate تا موفقیت همه سناریوهای الزامی و رفع موارد بحرانی
- Audit ایجاد/فعال‌سازی چرخه، نتیجه آزمون، اولویت‌بندی و Release Candidate

Migration شماره `019_uat.sql` باید اجرا شود. مجموعه تست شامل ۲۶ سناریو است.


## C.12 — آماده‌سازی Production

- Dockerfile و Compose عملیاتی با PostgreSQL، Migration یک‌باره، Health Check و Restart خودکار
- NGINX Reverse Proxy با HTTPS، محدودیت درخواست و سقف Upload
- اعتبارسنجی سخت‌گیرانه متغیرهای Production، Cookie امن، CORS مبتنی بر HTTPS و Trust Proxy
- Security Header، Timeout درخواست، Pool مقاوم PostgreSQL و Graceful Shutdown
- وضعیت مدیریتی Process/DB/Disk/HTTP و خروجی Prometheus
- Backup رمزگذاری‌شده روزانه، Rotation، نگهداری چند نسخه و کپی Offsite
- Runbook استقرار، ارتقا، Rollback، Restore Drill، مانیتورینگ و واکنش به رخداد در `docs/PRODUCTION.md`

دستورات جدید: `npm run production:check` و `npm run db:backup:rotate`. مجموعه تست شامل ۲۷ سناریو است.


## C.13 — آموزش و تحویل

- مرکز آموزش داخل برنامه با راهنمای اختصاصی مدیر سیستم، مدیرعامل، معاون، رابط، درمان/آموزش، مالی، مهاجرت و UAT
- تأیید مطالعه هر ماژول و گزارش پیشرفت آموزش کاربران
- چک‌لیست تحویل هشت‌مرحله‌ای با مدرک، مسئول، زمان و Audit
- مستند نصب/ارتقا/Rollback، Backup/Restore، رخداد، API و ساختار دیتابیس
- بسته راهنماهای فارسی در `docs/training` و مرجع فنی در `docs/reference`

Migration شماره `020_training_handover.sql` باید اجرا شود. مجموعه تست شامل ۲۸ سناریو است.

## C.14 — زیرساخت توسعه‌های آینده

مدیریت حامی، کمک نقدی/غیرنقدی، تخصیص به خانواده، انبار، فرم عمومی با کد رهگیری، Notification Outbox، مختصات داخلی و PWA نصب‌پذیر اضافه شد. API و داده حساس در Service Worker Cache نمی‌شوند و ارسال زنده SMS/Email نیازمند Provider خارجی است. جزئیات در `docs/FUTURE-EXTENSIONS.md` است.

Migration شماره `021_future_extensions.sql` باید اجرا شود. مجموعه تست شامل ۲۹ سناریو است.

## Button design system

The supplied button design has been adapted to the current no-build HTML/CSS frontend in
`public/button-system.css`. Existing `.primary`, `.secondary`, and `.danger` controls are
mapped to `brand`, `secondary`, and `destructive` variants automatically.

New controls can use one variant plus an optional size:

```html
<button class="btn-brand btn-lg">ثبت</button>
<button class="btn-outline btn-sm">انصراف</button>
<button class="btn-ghost btn-icon" aria-label="بستن">×</button>
```

Available variants: `btn-default`, `btn-secondary`, `btn-outline`, `btn-ghost`,
`btn-brand`, and `btn-destructive`. Available sizes: `btn-sm`, `btn-md`, `btn-lg`,
and `btn-icon`.

## Input design system

The supplied React `Input`, `Label`, and `Field` design is adapted for the current static
frontend in `public/input-system.css`. Existing `.field` and `.form-field` inputs are styled
automatically. New standalone fields can use `.input`, `.label`, `.field-group`,
`.field-hint`, and `.field-error`.

Addon example:

```html
<div class="field-group">
  <label class="label" for="phone">شماره تلفن</label>
  <div class="input-group" dir="ltr">
    <span class="input-addon">+98</span>
    <input id="phone" class="input-control" inputmode="tel" aria-describedby="phone-hint">
    <span class="input-addon">موبایل</span>
  </div>
  <p id="phone-hint" class="field-hint">شماره را بدون صفر ابتدایی وارد کنید.</p>
</div>
```

For validation, set `aria-invalid="true"` on the input and render its message using
`.field-error`. Use `dir="ltr"` for phone numbers, emails, identifiers, and codes.

## Advanced control system

`public/control-system.css` and `public/control-system.js` provide progressive, accessible
vanilla-JavaScript equivalents of the supplied React controls. Existing native selects and
number inputs are enhanced automatically, including controls inserted later in modals.
`#searchInput` is upgraded to a keyboard-accessible combobox with live family suggestions.

The control layer includes:

- Combobox: prefix-first filtering, substring fallback, Arrow/Enter/Escape handling and a
  fixed portal-style suggestion panel.
- Select: native semantics and mobile picker with an RTL-aware inline-end chevron.
- Number field: clamped plus/minus stepping while preserving the original form input.
- OTP: Persian display digits, Latin/Persian input and full-code paste through
  `ControlSystem.createOtp(element, options)`.
- Checkbox/radio/card-radio styles using native form controls.
- Switch behavior for `<button data-switch aria-checked="false">`.

`public/interface-polish.css` adds a refinement layer for the sticky glass header, toolbar,
cards, panels, modals, responsive layout and reduced-motion support.

## Advanced interaction layer

`public/advanced-ui.css` and `public/advanced-ui.js` add vanilla, progressively enhanced
implementations of the supplied Slider, RangeSlider, FileUpload, Jalali Calendar,
DatePicker, Command palette, Dialog/AlertDialog, DropdownMenu, Sheet, and Tabs APIs.

Applied automatically in the current product:

- Native range fields receive the RTL-aware filled track and Persian value display.
- Visible file inputs become keyboard-accessible drag-and-drop zones with file size lists.
- Native date inputs become Jalali calendar popovers while retaining ISO values for APIs.
- Existing generated modals gain Escape handling, focus containment/restoration, scroll lock,
  and outside-click dismissal where safe.
- A quick-command launcher is added to the header; `Ctrl+K`/`⌘K` searches and runs visible
  product actions with Arrow/Enter/Escape keyboard support.

Reusable APIs are available on `window.AdvancedUI`: `enhanceSlider`, `rangeSlider`,
`enhanceFile`, `calendar`, `enhanceDate`, `commandDialog`, `dialog`, `alertDialog`,
`dropdown`, `sheet`, and `tabs`.

## Navigation and data-display UX

`public/ux-system.css` and `public/ux-system.js` implement the supplied Breadcrumb, Stepper,
Sidebar, Toast, Alert, Progress, Badge, Table, and Stat patterns for the static frontend.

Current integration includes:

- The large operations button row is reorganized into a responsive, collapsible sidebar;
  existing event handlers and permission-based visibility remain unchanged.
- Family detail pages receive breadcrumbs, a calculated information-completeness percentage,
  a visual progress bar, and a five-stage workflow stepper.
- Existing status chips, finance states, warnings, metric cards, and HTML tables inherit the
  new badge, alert, stat, and responsive table presentation.
- Toasts support success/error/default variants, actions, a maximum visible stack, individual
  dismissal, and “dismiss all.”

Reusable functions are exposed through `window.UXSystem`.

## Product UX ordering and family payment card

- The Operations Center is ordered by importance: executive/reporting dashboards first,
  then alerts and work queues, follow-ups/search, organization/finance, administration,
  security/operations, and finally training/UAT.
- When a family detail is open and a third-layer modal is entered, a visible Back button is
  injected into the modal header.
- `migrations/022_head_card_number.sql` adds the family head’s monthly-support destination
  card number. Create/edit forms validate and format it; detail pages show only the last four
  digits by default.
- Password, Iranian phone, national-ID, card-number, form-validation, segmented status filter,
  card, price, timeline, chart and scrolling presentation utilities are included in
  `public/product-ui.*` and exposed through `window.ProductUI` where reusable.


## v20.0.3 — UI Phase 1

- بازطراحی کامل صفحه ورود با فرم سمت راست و پنل معرفی سمت چپ
- بهبود RTL، حالت فوکوس، نمایش رمز، پیام‌های خطا و تجربه موبایل
- حذف پیام‌های فنی از تجربه کاربر نهایی و افزودن فایل‌های مستقل `auth-v2.css` و `auth-v2.js`


## v20.0.4 — UI Phase 2

- پوسته اصلی نقش‌محور با سایدبار سمت راست و گروه‌بندی عملیات
- نمای امروز با داده‌های واقعی داشبورد، هشدارها و پیگیری‌های عقب‌افتاده
- سربرگ فضای کاری، دسترسی سریع، اعلان‌ها و منوی موبایل
- حفظ کامل قراردادهای API و عملکرد دکمه‌های فعلی


## v20.0.5 — Main page wording refinement

- جایگزینی عنوان داخلی «فاز دوم اتصال» با عنوان کاربردی «مدیریت پرونده‌ها»
- بهبود عنوان و توضیح بخش خانواده‌های تحت پوشش در صفحه اصلی


## v20.0.6 — Family toolbar layout fix

- رفع هم‌افتادگی کنترل «همه پرونده‌ها» و دکمه «به‌روزرسانی»
- تعریف ناحیه‌های مستقل Grid برای جست‌وجو، فیلتر وضعیت و عملیات
- چیدمان تک‌ستونه و بدون هم‌پوشانی در موبایل


## v20.0.7 — Interaction components

- تب‌های لغزان و سازگار با RTL برای فیلتر وضعیت پرونده
- Border Beam کنترل‌شده برای کارت اولویت‌ها
- Dock میانبرها و قابلیت سنجاق‌کردن بخش‌های پرکاربرد
- Reveal هنگام ورود بخش‌ها به viewport و نوار پیشرفت اسکرول
- دکمه سه‌حالته برای به‌روزرسانی و نشان موفقیت
- پیاده‌سازی سازگار با معماری فعلی Vanilla، بدون افزودن React/Tailwind به Runtime


## v20.0.8 — Family experience

- بازطراحی کارت‌های فهرست خانواده با هویت بصری، متادیتا و وضعیت روشن
- سربرگ یکپارچه پرونده با آواتار، وضعیت و اقدامات مرتب
- تب‌های پیمایش سریع بین خلاصه، اعضا، پرونده جامع، اقدامات، تخصصی، مالی و اسناد
- پوشاندن پیش‌فرض کد ملی و امکان نمایش کنترل‌شده
- بهبود تجربه دسکتاپ و موبایل صفحه پرونده خانواده


## v20.0.9 — Case wizard

- تبدیل فرم ایجاد و ویرایش پرونده به Wizard پنج‌مرحله‌ای
- اعتبارسنجی هر مرحله، درصد تکمیل و مرور نهایی
- ذخیره و بازیابی پیش‌نویس محلی برای پرونده جدید
- هشدار خروج با تغییرات ذخیره‌نشده
- حالت موفقیت پس از ایجاد یا ویرایش پرونده
- طراحی واکنش‌گرا برای دسکتاپ و موبایل


## v20.0.10 — اصلاح اسکرول فرم چندمرحله‌ای
- مودال فرم به چیدمان ستونی با ارتفاع محدود به viewport تبدیل شد.
- بدنهٔ فرم در دسکتاپ و موبایل اسکرول مستقل دارد.
- نوار اقدامات هنگام اسکرول در پایین فرم قابل دسترس باقی می‌ماند.
- اسکرول لمسی و overscroll موبایل بهینه شد.


## v20.0.11 — اعتبارسنجی هوشمند فرم پرونده
- تبدیل خودکار اعداد فارسی و عربی به انگلیسی برای ارسال امن به API.
- کنترل لحظه‌ای الگوریتم کد ملی، شماره موبایل، شماره کارت و تاریخ شمسی.
- بررسی شماره پرونده تکراری و هدایت خطای سرور به فیلد مربوط.
- تشخیص کد ملی تکراری میان سرپرست و اعضای همان فرم.
- قالب‌بندی مبالغ با جداکننده هزارگان و پاک‌سازی پیش از ارسال.
- پیام خطای درون‌خطی، وضعیت معتبر و تمرکز خودکار روی اولین خطا.


## v20.0.12 — مدیریت حرفه‌ای اعضای خانواده
- نمایش اعضا به‌صورت کارت‌های شماره‌دار و جمع‌شونده.
- خلاصه نام، نسبت، سن تقریبی و وضعیت تکمیل روی هر کارت.
- فهرست استاندارد نسبت خانوادگی با حفظ مقادیر قدیمی.
- شمارنده اعضای ثبت‌شده، کامل و نیازمند تکمیل.
- تشخیص عضو ناقص یا کد ملی تکراری و بازکردن خودکار کارت خطادار.
- تأیید پیش از حذف عضو دارای اطلاعات.
- چیدمان مستقل و بهینه برای موبایل و دسکتاپ.


## v20.0.13 — مرکز اقدام پس از ثبت پرونده
- جایگزینی پیام موفقیت موقت با صفحه اقدام تعاملی.
- نمایش خلاصه شماره پرونده، سرپرست و تعداد اعضا.
- اتصال مستقیم به مشاهده پرونده، ثبت پیگیری و ایجاد پرونده دیگر.
- پشتیبانی از بستن با دکمه، کلید Escape و فوکوس اولیه مناسب.
- مسیر مستقل پس از ثبت و ویرایش پرونده.
- چیدمان دیالوگ دسکتاپ و bottom-sheet موبایل.


## v20.0.14 — تجربه ساختاریافته ثبت پیگیری
- نمایش خانواده و شماره پرونده در ابتدای فرم پیگیری.
- وضعیت پیگیری چهارتایی با کنترل بخش‌بندی‌شده.
- زمان‌بندی سریع برای امروز، فردا و یک هفته بعد.
- الگوهای آماده تماس تلفنی، بازدید منزل و بررسی مدارک.
- شمارنده متن، عنوان کوتاه و انتخاب مسئول پیگیری.
- غیرفعال‌شدن موعد بعدی برای وضعیت‌های تمام‌شده و لغوشده.
- هشدار خروج با تغییرات ثبت‌نشده و اعتبارسنجی شرح پیگیری.
- طراحی مستقل دسکتاپ و bottom-sheet قابل اسکرول موبایل.


## v20.0.15 — تایم‌لاین سابقه پیگیری‌ها
- حذف نمایش تکراری و قدیمی یادداشت‌ها از جزئیات پرونده.
- خلاصه کل، فعال، عقب‌افتاده و انجام‌شده به‌همراه نزدیک‌ترین موعد.
- فیلترهای همه، باز و فعال، در حال پیگیری، انجام‌شده و عقب‌افتاده.
- تایم‌لاین وضعیت‌محور با مسئول، زمان ثبت، موعد بعدی و یادداشت مؤسسه.
- برجسته‌سازی موارد عقب‌افتاده و وضعیت‌های انجام‌شده یا لغوشده.
- حالت خالی مستقل برای هر فیلتر و اتصال مستقیم به فرم ثبت پیگیری.
- چیدمان واکنش‌گرا برای دسکتاپ و موبایل.


## v20.0.16 — برد اقدامات ساده و راهنمای مسیر
- برد کانبان چهارمرحله‌ای برای برنامه‌ریزی، انجام، انتظار تأیید و بستن اقدامات.
- اولویت، مسئول، موعد، موارد عقب‌افتاده، فیلترها و درصد پیشرفت.
- عملیات سریع تعیین مسئول، ثبت نتیجه، تأیید یا درخواست اصلاح.
- ساخت اقدام مستقل یا تبدیل مستقیم یک پیگیری به اقدام.
- ساده‌سازی ناوبری، نمایش مرحله‌ای بخش‌های تخصصی و راهنمای «کار بعدی چیست؟».
- طراحی واکنش‌گرا و قابل استفاده در موبایل و دسکتاپ.
