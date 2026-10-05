# مرجع API

تمام `/api/*`ها به نشست معتبر HttpOnly نیاز دارند. خطاهای متداول: 400 اعتبارسنجی، 401 نشست، 403 مجوز، 404 موجودیت، 409 تعارض گردش‌کار، 429 محدودیت ورود. گروه‌ها: Auth، Families، Organization، Supervision، Actions، Specialist، Financial، Alerts، Management Reports، Comprehensive، Security، Data Migration، UAT، Operations و Training. شناسه‌ها UUID هستند؛ مبلغ‌ها در خروجی رشته ده‌دهی‌اند؛ دانلود حساس هدر `X-Access-Reason` می‌خواهد. قرارداد دقیق از Routeهای TypeScript و تست Integration استخراج می‌شود.
