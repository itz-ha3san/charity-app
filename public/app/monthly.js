/* Monthly request bundles: no bank transfer, no client-side personal-data storage. */
(() => {
    const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const digits = v => Number(v).toLocaleString('fa-IR', { useGrouping: false });
    const fmt = v => BigInt(v ?? 0).toLocaleString('fa-IR'), cash = v => `${fmt(v)} <small>تومان</small>`;
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const errors = { MONTHLY_PERIOD_INVALID: 'فقط دوره‌های گذشته، ماه جاری و ماه آینده قابل انتخاب هستند.', MONTHLY_NO_FAMILIES: 'برای این رابط خانوادهٔ فعالی وجود ندارد.', MONTHLY_DATA_CHANGED: 'اطلاعات خانواده‌ها تغییر کرده است؛ فهرست را تازه کنید و دوباره مرور کنید.', MONTHLY_AID_CHANGED: 'وضعیت یک کمک تغییر کرده است؛ فهرست را تازه کنید.', MONTHLY_INCOMPLETE: 'مبلغ ماهیانهٔ ناقص یا درخواست تکراری وجود دارد؛ ابتدا پرونده‌های مشخص‌شده را اصلاح کنید.', MONTHLY_PERIOD_EXISTS: 'برای یکی از خانواده‌ها این ماه قبلاً ثبت شده است.', MONTHLY_ALREADY_SUBMITTED: 'این فهرست قبلاً ثبت شده است.', FORBIDDEN: 'دسترسی به این فهرست ندارید.', FAMILY_SCOPE_FORBIDDEN: 'دسترسی خانواده‌های این صورت‌حساب تغییر کرده است.', MIGRATIONS_REQUIRED: 'ساختار پایگاه دادهٔ ماهیانه آماده نیست؛ مدیر سامانه باید migration شمارهٔ 034 را اجرا کند.', INVALID_LIAISON: 'رابط انتخاب‌شده فعال یا معتبر نیست؛ رابط دیگری انتخاب کنید.', VALIDATION_ERROR: 'رابط و دورهٔ انتخاب‌شده معتبر نیستند؛ دوباره بررسی کنید.', RETRYABLE_CONFLICT: 'عملیات هم‌زمان رخ داده است؛ فهرست را تازه و دوباره بررسی کنید.' };
    window.openMonthlyRequests = async function () {
        const actor = window.currentActor;
        if (!actor || !(actor.role === 'admin' || ['liaison', 'ceo', 'supervision_deputy'].includes(actor.position)))
            return;
        let root, data = null, liaisons = [], selected = new Set(), busy = false, review = false, dirty = false, query = '', supervisor = '', epoch = 0, liaisonLoaded = false;
        let imageUrls = [];
        const expanded = new Set(), receiptExpanded = new Set();
        function clearImages(){for(const url of imageUrls)URL.revokeObjectURL(url);imageUrls=[];}
        const observer=new MutationObserver(()=>{if(!root?.isConnected){clearImages();observer.disconnect();}});
        const now = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Tehran' }).formatToParts(new Date());
        let year = Number(now.find(p => p.type === 'year').value), month = Number(now.find(p => p.type === 'month').value), liaisonId = actor.position === 'liaison' ? actor.id : '';
        const active = () => root?.isConnected && document.querySelector('.monthly-modal') === root && window.currentActor?.id === actor.id;
        const close = () => { if (busy)
            return; if (dirty && !confirm('تغییرات ذخیره نشده‌اند؛ فرم بسته شود؟'))
            return; epoch++; window.closeModal?.(); };
        const logo = () => document.documentElement.dataset.theme === 'dark' ? '/brand/charity-logo-dark.png' : '/brand/charity-logo.png';
        AppUI.mountModal('<div class="modal-backdrop mn-page-backdrop"><section class="modal monthly-modal" dir="rtl"><div class="mn-loading" role="status">در حال دریافت فهرست ماهیانه…</div></section></div>', close);
        root = document.querySelector('.monthly-modal');
        observer.observe(root.parentNode,{childList:true});
        root.setAttribute('aria-label', 'درخواست مالی ماهیانه');
        root.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                close();
            }
            if (event.key === 'Tab') {
                event.stopPropagation();
                const nodes = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(n => n.getClientRects().length);
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        });
        function sums() { const groups = data.snapshot.groups.map(g => ({ ...g, families: g.families.map(f => { const extras = f.aids.filter(a => selected.has(a.id)), extra = extras.reduce((s, a) => s + BigInt(a.amount), 0n); return { ...f, extras, extraAmount: extra, totalAmount: BigInt(f.baseAmount ?? 0) + extra }; }) })); for (const g of groups)
            g.totalAmount = g.families.reduce((s, f) => s + f.totalAmount, 0n); const families = groups.flatMap(g => g.families); return { groups, families, base: families.reduce((s, f) => s + BigInt(f.baseAmount ?? 0), 0n), total: groups.reduce((s, g) => s + g.totalAmount, 0n) }; }
        function message(text, tone = 'info') { if (!active())
            return; const node = root.querySelector('.mn-message'); if (node) {
            node.textContent = text;
            node.dataset.tone = tone;
            node.setAttribute('role', tone === 'error' ? 'alert' : 'status');
            node.focus();
        } }
        function controls() { return `<details class="mn-period"><summary><span><small>دورهٔ درخواست</small><b>${months[month - 1]} ${digits(year)}</b></span>${icon('calendar')}<span aria-hidden="true">⌄</span></summary><div class="mn-period-popover"><label>رابط خیریه<select data-control-enhanced="true" data-mn-liaison ${busy ? 'disabled' : ''}>${liaisons.map(l => `<option value="${e(l.id)}" ${l.id === liaisonId ? 'selected' : ''}>${e(l.name)}</option>`).join('')}</select></label><div><label>سال شمسی<input data-control-enhanced="true" data-mn-year type="number" min="1300" max="1600" value="${year}"></label><label>ماه<select data-control-enhanced="true" data-mn-month>${months.map((m, i) => `<option value="${i + 1}" ${month === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div><button type="button" class="mn-primary" data-mn-load ${!liaisons.length ? 'disabled' : ''}>نمایش دوره</button></div></details>`; }
        function icon(name) {
            const paths = { calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>', receipt:'<path d="M6 2h8l4 4v16H6zM14 2v5h4M9 11h6m-6 4h6m-6 4h6"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>' };
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.receipt}</svg>`;
        }
        function loadError(err) { return errors[err.data?.error] || (err.status === 401 ? 'نشست شما پایان یافته است؛ دوباره وارد سامانه شوید.' : err.status === 404 ? 'مسیر ماهیانه در سرور پیدا نشد؛ نسخهٔ سرور و برنامه را بررسی کنید.' : err.status >= 500 ? 'سرور نتوانست فهرست ماهیانه را دریافت کند؛ مدیر سامانه باید گزارش خطای سرور و وضعیت migration را بررسی کند.' : 'دریافت فهرست انجام نشد؛ اتصال را بررسی و از انتخاب دوره دوباره تلاش کنید.'); }
        function familyReceipt(f) {
            return `<article class="mn-family-receipt" data-mn-receipt-family="${e(f.id)}"><header><div><b>خانوادهٔ ${e(f.familyName)}</b><small>مجموع واریزی این خانواده</small></div><strong data-mn-family-total>${cash(f.totalAmount)}</strong></header><div class="mn-family-breakdown"><div><span>ماهیانه</span><b>${f.baseAmount === null ? 'تعیین نشده' : cash(f.baseAmount)}</b></div><div><span>موردی</span><b>${cash(f.extraAmount)}</b></div></div>${f.baseAmount === null ? '<p class="mn-family-warning">مبلغ ماهیانه نامشخص است؛ جمع این خانواده نهایی نیست.</p>' : ''}<div class="mn-family-aids">${f.extras.map(a => `<div><span>موضوع: ${e(a.category)} · ${e(a.title)}</span><strong>${cash(a.amount)}</strong></div>`).join('') || '<p>کمک موردی اضافه نشده است.</p>'}</div></article>`;
        }
        function receipt(s) { return `<aside class="mn-receipt"><div class="mn-receipt-icon" aria-hidden="true">${icon('receipt')}</div><h3>جمع کل ماهیانهٔ رابط</h3><p>${e(data.liaisonName)} · ${months[month - 1]} ${digits(year)}</p><div class="mn-line"><span>خانواده‌های این فهرست</span><b>${fmt(s.families.length)} خانواده</b></div><div class="mn-line"><span>تعداد سرپرست‌ها</span><b>${fmt(s.groups.length)}</b></div><p>مجموع واریزی هر سرپرست</p><p class="mn-note">واریزی هر خانواده، جداگانه به سرپرست انجام می‌شود.</p>${s.groups.map(g => `<section class="mn-supervisor-receipt"><div class="mn-line"><span>${e(g.supervisorName)}<small>${fmt(g.families.length)} خانواده</small></span><b>${cash(g.totalAmount)}</b></div><details class="mn-supervisor-details" data-mn-receipt-group="${e(g.supervisorId || 'unassigned')}" ${receiptExpanded.has(g.supervisorId || 'unassigned')?'open':''}><summary>مشاهدهٔ تفکیک واریزی خانواده‌ها ⌄</summary>${g.families.map(familyReceipt).join('')}</details></section>`).join('')}<div class="mn-line"><span>جمع مبالغ ثابت ماهیانه</span><b>${cash(s.base)}</b></div><section class="mn-extra-details"><h4>جزئیات کمک‌های موردی</h4>${s.families.flatMap(f => f.extras.map(a => `<article><b>خانوادهٔ ${e(f.familyName)}</b><small>سرپرست: ${e(f.supervisorName)}</small><p>موضوع: ${e(a.category)} · ${e(a.title)}</p><strong>${cash(a.amount)}</strong></article>`)).join('') || '<p>کمک موردی به صورت‌حساب افزوده نشده است.</p>'}</section><div class="mn-grand"><p>مجموع واریزی همهٔ خانواده‌ها</p><strong data-mn-grand>${fmt(s.total)}</strong><small>تومان</small></div><button type="button" data-mn-image ${!s.families.length?'disabled':''}>دانلود فاکتور PNG</button><div class="mn-export-results" aria-live="polite"></div><p class="mn-note">ثبت این فهرست، درخواست مالی است و به معنی تأیید یا انتقال وجه نیست.</p>${data.status === 'submitted' ? '<div class="mn-success">درخواست این دوره ثبت شده است.</div>' : `<button class="mn-primary" type="button" data-mn-review ${!s.families.length || s.families.some(f => f.baseAmount === null || f.conflict) ? 'disabled' : ''}>${review ? 'تأیید و ثبت درخواست ماهیانه' : 'مرور صورت‌حساب‌ها'}</button><button type="button" data-mn-save>ذخیرهٔ پیش‌نویس</button>${review ? '<button type="button" data-mn-edit>ویرایش فهرست</button>' : ''}`}</aside>`; }
        function invoice(g, forceWide = false) {
            const visible = g.families.filter(f => !query || `${f.familyName} ${f.caseNumber} ${g.supervisorName}`.includes(query));
            if (!visible.length) return '';
            const id = g.supervisorId || 'unassigned', hasAids = visible.some(f => f.aids.length), compact = g.families.length === 1 && !hasAids;
            return `<article class="mn-invoice ${compact && !forceWide ? 'mn-invoice-compact' : 'mn-invoice-wide'}"><header><div class="mn-invoice-heading"><span class="mn-person-icon">${icon('people')}</span><div><small>درخواست مالی ماهیانه · ${months[month - 1]} ${digits(year)}</small><h3>نام سرپرست: ${e(g.supervisorName)}</h3><p>ماهیانهٔ خانواده‌های تحت پوشش (${fmt(g.families.length)} خانواده)</p></div></div><div class="mn-invoice-actions"><span class="mn-success">✓ همه در فهرست</span><button type="button" class="mn-group-image" data-mn-group-image="${e(id)}" aria-label="دانلود عکس فاکتور ${e(g.supervisorName)}">دانلود فاکتور ↓</button></div></header><div class="mn-table-wrap"><table data-ui-table="1" data-native-table="true"><colgroup><col style="width:7%"><col style="width:26%"><col style="width:24%"><col style="width:20%"><col style="width:23%"></colgroup><thead><tr><th>ردیف</th><th>خانواده</th><th>ماهیانه <small>تومان</small></th><th>موردی <small>تومان</small></th><th>مبلغ واریزی <small>تومان</small></th></tr></thead><tbody>${visible.map((f,i) => `<tr><td class="mn-row-number">${fmt(i+1)}</td><th scope="row">${e(f.familyName)}${f.conflict ? '<em>این دوره قبلاً ثبت شده</em>' : ''}</th><td>${f.baseAmount === null ? '<em>تعیین نشده</em>' : fmt(f.baseAmount)}</td><td class="${f.extraAmount ? 'mn-extra-value' : ''}">${f.extraAmount ? '+ ' + fmt(f.extraAmount) : '—'}</td><td><b>${fmt(f.totalAmount)}</b></td></tr>${f.extras.length ? `<tr class="mn-attached-row"><td colspan="5">${f.extras.map(a => `<div class="mn-attached-aid"><span class="mn-static-check" aria-hidden="true">✓</span><div><b>خانوادهٔ ${e(f.familyName)} · ${e(a.title)}</b><small>${e(a.category)} · تأییدشده · به صورت‌حساب این خانواده اضافه شد</small></div><strong>${cash(a.amount)}</strong><button type="button" data-mn-change="${e(id)}" ${review || data.status==='submitted'?'disabled':''}>تغییر انتخاب</button></div>`).join('')}</td></tr>` : ''}`).join('')}</tbody></table></div>${hasAids ? `<details class="mn-aid-picker" data-mn-picker="${e(id)}" ${expanded.has(id)?'open':''}><summary>انتخاب کمک‌های موردی خانواده‌ها <span>+</span></summary><div class="mn-aid-grid">${visible.flatMap(f => f.aids.map(a => `<label class="mn-aid ${selected.has(a.id) ? 'is-selected' : ''}"><input type="checkbox" data-mn-aid="${e(a.id)}" ${selected.has(a.id) ? 'checked' : ''} ${review || data.status === 'submitted' ? 'disabled' : ''}><span><b>${e(a.title)}</b><small>خانوادهٔ ${e(f.familyName)} · ${e(a.category)}</small><small>تأییدشده${data.status === 'submitted' ? '' : ' و پرداخت‌نشده'}</small></span><strong>${cash(a.amount)}</strong></label>`)).join('')}</div></details>` : ''}<footer><span>مجموع واریزی سرپرست<small>ثابت ${fmt(g.families.reduce((v,f)=>v+BigInt(f.baseAmount??0),0n))} + موردی ${fmt(g.families.reduce((v,f)=>v+f.extraAmount,0n))} تومان · همهٔ خانواده‌ها</small></span><strong>${cash(g.totalAmount)}</strong></footer></article>`;
        }
        function renderInvoices(groups) {
            const visible = groups.filter(g => (!supervisor || (g.supervisorId || 'unassigned') === supervisor) && g.families.some(f => !query || `${f.familyName} ${f.caseNumber} ${g.supervisorName}`.includes(query)));
            const compact = g => g.families.length === 1 && !g.families[0].aids.length;
            return visible.map((g,i) => {
                if (!compact(g)) return invoice(g);
                let start=i,end=i+1;
                while(start>0 && compact(visible[start-1]))start--;
                while(end<visible.length && compact(visible[end]))end++;
                return invoice(g,(end-start)%2===1 && i===end-1);
            }).join('');
        }
        function render() {
            if (!active())
                return;
            clearImages();
            const s = data ? sums() : null;
            root.innerHTML = `<div class="mn-page"><header class="mn-top"><div class="mn-brand"><img src="${logo()}" alt="نشان خیریه"><span>سامانهٔ مدیریت خانواده‌ها <i>/</i> ثبت ماهیانه</span></div><div class="mn-actor"><span class="mn-avatar">${icon('people')}</span><span>${e(data?.liaisonName || actor.name || 'رابط خیریه')}<small>رابط خیریه</small></span><button type="button" data-mn-close aria-label="بستن فرم ماهیانه">بازگشت</button></div></header><section class="mn-hero"><div><small>● فهرست کامل رابط، صورت‌حساب جدا برای هر سرپرست</small><h2 id="monthlyRequestTitle">درخواست مالی ماهیانه</h2><p>تمام خانواده‌ها در فهرست هستند؛ کمک‌های موردی تأییدشده را به صورت‌حساب همان خانواده اضافه کنید.</p></div>${controls()}</section><div class="mn-message" role="alert" tabindex="-1"></div>${data ? `<div class="mn-coverage"><span class="mn-coverage-check">✓</span><div><b>${fmt(s.families.length)} از ${fmt(s.families.length)} خانواده در فهرست ماهیانه</b><small>رابط: ${e(data.liaisonName)} · ${fmt(s.groups.length)} سرپرست · هیچ خانواده‌ای با جست‌وجو یا فیلتر از درخواست حذف نمی‌شود${data.status === 'submitted' ? ' · ثبت‌شده (فقط مشاهده)' : ''}</small></div><span class="mn-coverage-pill">پوشش کامل</span></div>${data.draftChanged ? '<p class="mn-warning">وضعیت برخی کمک‌های پیش‌نویس تغییر کرده و از انتخاب خارج شده‌اند؛ مبالغ را دوباره بررسی کنید.</p>' : ''}${s.families.some(f => f.baseAmount === null || f.conflict) ? '<p class="mn-warning">ثبت نهایی تا اصلاح مبلغ‌های نامشخص یا درخواست‌های تکراری ممکن نیست. مبلغ صفرِ صریح قابل ثبت است.</p>' : ''}${review ? '<div class="mn-warning">مرور نهایی: همهٔ خانواده‌ها و جزئیات موردی‌ها را بررسی کنید؛ تأیید، درخواست‌های ثابت را برای بررسی مالی ثبت می‌کند.</div>' : ''}<div class="mn-layout"><main><div class="mn-list-top"><h3>صورت‌حساب‌ها به تفکیک سرپرست <small>${fmt(s.groups.length)} صورت‌حساب</small></h3><button type="button" data-mn-expand>باز کردن همه ⌄</button></div><div class="mn-filters"><label class="mn-search"><span class="mn-sr-only">جست‌وجوی سرپرست یا خانواده</span>${icon('search')}<input data-mn-query placeholder="جست‌وجوی نام سرپرست یا خانواده…" value="${e(query)}"></label><label><span class="mn-sr-only">سرپرست</span><select data-control-enhanced="true" data-mn-supervisor><option value="">همهٔ سرپرست‌های این رابط</option>${s.groups.map(g => `<option value="${e(g.supervisorId || 'unassigned')}" ${supervisor === (g.supervisorId || 'unassigned') ? 'selected' : ''}>${e(g.supervisorName)}</option>`).join('')}</select></label></div><div class="mn-invoices">${renderInvoices(s.groups) || '<p class="mn-empty">موردی با این جست‌وجو یافت نشد؛ کل فهرست همچنان محفوظ است.</p>'}</div></main><div class="mn-sidebar">${receipt(s)}<section class="mn-help"><b>تفکیک روشن، جمع یکپارچه</b><p>رابط می‌تواند چند سرپرست داشته باشد؛ برای هر سرپرست یک صورت‌حساب جدا ساخته می‌شود. جمع نهایی شامل همهٔ آن‌هاست.</p></section><section class="mn-help"><b>موردی متعلق به همان خانواده</b><p>فقط موردی‌های تأییدشده و پرداخت‌نشدهٔ همان خانواده قابل انتخاب‌اند؛ مبلغ آن هم در ردیف خانواده و هم در جمع سرپرست دیده می‌شود.</p></section></div></div>` : `<div class="mn-empty"><h3>فهرست ماهیانه هنوز دریافت نشده است</h3><p>${liaisons.length?'از انتخاب دوره در بالای صفحه، رابط و ماه را بررسی کنید و دوباره تلاش کنید.':liaisonLoaded ? 'رابط خیریهٔ فعالی برای حساب شما در دسترس نیست.' : 'فهرست رابط‌ها دریافت نشده است؛ اتصال را بررسی و صفحه را دوباره باز کنید.'}</p></div>`}<footer class="mn-page-footer">همهٔ خانواده‌ها در فهرست · مبالغ به تومان · ثبت درخواست به معنی انتقال وجه نیست.</footer></div>`;
            root.setAttribute('aria-labelledby', 'monthlyRequestTitle');
            root.querySelector('[data-mn-close]').onclick = close;
            root.querySelector('[data-mn-load]').onclick = () => { if (dirty && !confirm('تغییرات ذخیره نشده‌اند؛ دوره عوض شود؟'))
                return; liaisonId = root.querySelector('[data-mn-liaison]').value; year = Number(root.querySelector('[data-mn-year]').value); month = Number(root.querySelector('[data-mn-month]').value); query = ''; supervisor = ''; load(); };
            root.querySelectorAll('[data-mn-receipt-group]').forEach(n=>n.ontoggle=()=>{n.open?receiptExpanded.add(n.dataset.mnReceiptGroup):receiptExpanded.delete(n.dataset.mnReceiptGroup);});
            root.querySelectorAll('[data-mn-picker]').forEach(n => n.ontoggle = () => { n.open ? expanded.add(n.dataset.mnPicker) : expanded.delete(n.dataset.mnPicker); });
            root.querySelectorAll('[data-mn-change]').forEach(n => n.onclick = () => { const picker = [...root.querySelectorAll('[data-mn-picker]')].find(p=>p.dataset.mnPicker===n.dataset.mnChange); if(picker){picker.open=true;expanded.add(n.dataset.mnChange);picker.querySelector('input')?.focus();} });
            root.querySelector('[data-mn-expand]')?.addEventListener('click',()=>{ root.querySelectorAll('[data-mn-picker]').forEach(n=>{n.open=true;expanded.add(n.dataset.mnPicker);}); });
            root.querySelectorAll('[data-mn-aid]').forEach(n => n.onchange = () => { n.checked ? selected.add(n.dataset.mnAid) : selected.delete(n.dataset.mnAid); dirty = true; render(); root.querySelector(`[data-mn-aid="${n.dataset.mnAid}"]`)?.focus(); });
            const search = root.querySelector('[data-mn-query]');
            if (search)
                search.oninput = () => { query = search.value; const start = search.selectionStart; render(); const n = root.querySelector('[data-mn-query]'); n.focus(); n.setSelectionRange(start, start); };
            const filter = root.querySelector('[data-mn-supervisor]');
            if (filter)
                filter.onchange = () => { supervisor = filter.value; render(); };
            root.querySelector('[data-mn-review]')?.addEventListener('click', () => { if (review)
                save(true);
            else {
                review = true;
                query = '';
                supervisor = '';
                render();
                root.scrollTop = 0;
            } });
            root.querySelector('[data-mn-image]')?.addEventListener('click',()=>downloadInvoice());
            root.querySelectorAll('[data-mn-group-image]').forEach(button=>button.addEventListener('click',()=>downloadInvoice(button.dataset.mnGroupImage)));
            root.querySelector('[data-mn-save]')?.addEventListener('click', () => save(false));
            root.querySelector('[data-mn-edit]')?.addEventListener('click', () => { review = false; render(); });
        }
        function setBusy(on) { busy = on; if (active()) {
            root.setAttribute('aria-busy', String(on));
            root.querySelectorAll('button,input,select').forEach(n => { if (on) {
                n.dataset.mnDisabled = String(n.disabled);
                n.disabled = true;
            }
            else if (n.dataset.mnDisabled !== undefined) {
                n.disabled = n.dataset.mnDisabled === 'true';
                delete n.dataset.mnDisabled;
            } });
        } }
        async function load() { if (busy)
            return; const token = ++epoch; setBusy(true); try {
            const result = await api('/api/monthly-requests?' + new URLSearchParams({ liaisonId, jalaliYear: String(year), jalaliMonth: String(month) }));
            if (!active() || token !== epoch)
                return;
            data = result;
            year = result.jalaliYear;
            month = result.jalaliMonth;
            liaisonId = result.liaisonId;
            selected = new Set(result.selectedIds);
            dirty = false;
            review = false;
            render();
        }
        catch (err) {
            data = null;
            selected = new Set();
            if (active())
                render();
            message(loadError(err), 'error');
        }
        finally {
            setBusy(false);
        } }
        async function downloadInvoice(groupId){
            if(busy||!data)return;
            const snapshot=sums(),groups=groupId?snapshot.groups.filter(g=>(g.supervisorId||'unassigned')===groupId):snapshot.groups;
            const meta={groups,liaisonName:data.liaisonName,year:data.jalaliYear,month:data.jalaliMonth,status:data.status,logoUrl:'/brand/charity-logo-dark.png',isActive:active};
            setBusy(true);
            message('در حال آماده‌سازی عکس فاکتور…');
            try{
                await AppAssets.load('monthlyImage');
                if(!active())return;
                const pages=await MonthlyInvoiceImage.create(meta);
                if(!active())return;
                clearImages();
                const result=root.querySelector('.mn-export-results');result.replaceChildren();
                const notice=document.createElement('p');notice.textContent=pages.length>1?'فاکتور در چند تصویر آماده شد؛ هر صفحه را جداگانه دانلود کنید.':'عکس فاکتور آماده است؛ برای ذخیره، دکمهٔ زیر را بزنید.';result.append(notice);
                pages.forEach((blob,index)=>{const url=URL.createObjectURL(blob);imageUrls.push(url);const link=document.createElement('a');link.href=url;link.download=`monthly-${data.jalaliYear}-${String(data.jalaliMonth).padStart(2,'0')}-${groupId?'supervisor':'all'}-${index+1}.png`;link.textContent=pages.length>1?'دانلود صفحهٔ '+fmt(index+1)+' (PNG)':'ذخیرهٔ عکس فاکتور (PNG)';result.append(link);});
                message('عکس شامل تمام خانواده‌های فاکتور است؛ جست‌وجو و فیلتر روی خروجی اثر ندارند.');
                result.scrollIntoView({block:'nearest'});result.querySelector('a')?.focus();
            }catch(error){if(error.message!=='EXPORT_CANCELLED')message(error.message==='INVOICE_TOO_LONG'?'فاکتور بسیار طولانی است؛ عکس هر سرپرست را جداگانه دریافت کنید.':'ساخت عکس انجام نشد؛ بارگذاری فونت و لوگو و اتصال را بررسی و دوباره تلاش کنید.');}
            finally{setBusy(false);}
        }
        async function save(submit) { if (busy || !data)
            return; setBusy(true); try {
            await api('/api/monthly-requests', { method: 'POST', body: JSON.stringify({ liaisonId: data.liaisonId, jalaliYear: data.jalaliYear, jalaliMonth: data.jalaliMonth, revision: data.revision, selectedIds: [...selected], submit }) });
            if (!active())
                return;
            dirty = false;
            if (submit) {
                data.status = 'submitted';
                review = false;
            }
            render();
            message(submit ? 'درخواست ماهیانه ثبت شد؛ وجهی منتقل نشده است.' : 'پیش‌نویس ذخیره شد.');
        }
        catch (err) {
            message(errors[err.data?.error] || 'ثبت انجام نشد یا نتیجه نامشخص است؛ با «نمایش دوره» وضعیت سرور را بررسی کنید.');
        }
        finally {
            setBusy(false);
        } }
        try {
            const result = await api('/api/monthly-requests/liaisons');
            if (!active())
                return;
            liaisons = result.liaisons;
            liaisonLoaded = true;
            if (!liaisons.some(l => l.id === liaisonId))
                liaisonId = liaisons[0]?.id || '';
            render();
            if (liaisonId)
                await load();
            if (active())
                root.querySelector('[data-mn-close]')?.focus();
        }
        catch (err) {
            if (active()) {
                render();
                message(loadError(err), 'error');
            }
        }
    };
})();
