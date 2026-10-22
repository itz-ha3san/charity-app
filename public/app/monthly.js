/* Monthly request bundles: no bank transfer, no client-side personal-data storage. */
(() => {
    const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = v => BigInt(v ?? 0).toLocaleString('fa-IR'), cash = v => `${fmt(v)} <small>تومان</small>`;
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const errors = { MONTHLY_PERIOD_INVALID: 'فقط دوره‌های گذشته، ماه جاری و ماه آینده قابل انتخاب هستند.', MONTHLY_NO_FAMILIES: 'برای این رابط خانوادهٔ فعالی وجود ندارد.', MONTHLY_DATA_CHANGED: 'اطلاعات خانواده‌ها تغییر کرده است؛ فهرست را تازه کنید و دوباره مرور کنید.', MONTHLY_AID_CHANGED: 'وضعیت یک کمک تغییر کرده است؛ فهرست را تازه کنید.', MONTHLY_INCOMPLETE: 'مبلغ ماهیانهٔ ناقص یا درخواست تکراری وجود دارد؛ ابتدا پرونده‌های مشخص‌شده را اصلاح کنید.', MONTHLY_PERIOD_EXISTS: 'برای یکی از خانواده‌ها این ماه قبلاً ثبت شده است.', MONTHLY_ALREADY_SUBMITTED: 'این فهرست قبلاً ثبت شده است.', FORBIDDEN: 'دسترسی به این فهرست ندارید.', FAMILY_SCOPE_FORBIDDEN: 'دسترسی خانواده‌های این صورت‌حساب تغییر کرده است.', RETRYABLE_CONFLICT: 'عملیات هم‌زمان رخ داده است؛ فهرست را تازه و دوباره بررسی کنید.' };
    window.openMonthlyRequests = async function () {
        const actor = window.currentActor;
        if (!actor || !(actor.role === 'admin' || ['liaison', 'ceo', 'supervision_deputy'].includes(actor.position)))
            return;
        let root, data = null, liaisons = [], selected = new Set(), busy = false, review = false, dirty = false, query = '', supervisor = '', epoch = 0;
        let imageUrls = [];
        function clearImages(){for(const url of imageUrls)URL.revokeObjectURL(url);imageUrls=[];}
        const observer=new MutationObserver(()=>{if(!root?.isConnected){clearImages();observer.disconnect();}});
        const now = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Tehran' }).formatToParts(new Date());
        let year = Number(now.find(p => p.type === 'year').value), month = Number(now.find(p => p.type === 'month').value), liaisonId = actor.position === 'liaison' ? actor.id : '';
        const active = () => root?.isConnected && document.querySelector('.monthly-modal') === root && window.currentActor?.id === actor.id;
        const close = () => { if (busy)
            return; if (dirty && !confirm('تغییرات ذخیره نشده‌اند؛ فرم بسته شود؟'))
            return; epoch++; window.closeModal?.(); };
        const logo = () => document.documentElement.dataset.theme === 'dark' ? '/brand/charity-logo-dark.png' : '/brand/charity-logo.png';
        AppUI.mountModal('<div class="modal-backdrop"><section class="modal monthly-modal" dir="rtl"><div class="mn-loading" role="status">در حال دریافت فهرست ماهیانه…</div></section></div>', close);
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
                const nodes = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(n => n.getClientRects().length);
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
        function message(text) { if (!active())
            return; const node = root.querySelector('.mn-message'); if (node) {
            node.textContent = text;
            node.focus();
        } }
        function controls() { return `<div class="mn-selectors"><label>رابط خیریه<select data-mn-liaison ${busy ? 'disabled' : ''}>${liaisons.map(l => `<option value="${e(l.id)}" ${l.id === liaisonId ? 'selected' : ''}>${e(l.name)}</option>`).join('')}</select></label><label>سال شمسی<input data-mn-year type="number" min="1300" max="1600" value="${year}"></label><label>دورهٔ درخواست<select data-mn-month>${months.map((m, i) => `<option value="${i + 1}" ${month === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label><button type="button" data-mn-load>نمایش دوره</button></div>`; }
        function familyReceipt(f) {
            return `<article class="mn-family-receipt" data-mn-receipt-family="${e(f.id)}"><header><div><b>خانوادهٔ ${e(f.familyName)}</b><small>مجموع واریزی این خانواده</small></div><strong data-mn-family-total>${cash(f.totalAmount)}</strong></header><div class="mn-family-breakdown"><div><span>ماهیانه</span><b>${f.baseAmount === null ? 'تعیین نشده' : cash(f.baseAmount)}</b></div><div><span>موردی</span><b>${cash(f.extraAmount)}</b></div></div>${f.baseAmount === null ? '<p class="mn-family-warning">مبلغ ماهیانه نامشخص است؛ جمع این خانواده نهایی نیست.</p>' : ''}<div class="mn-family-aids">${f.extras.map(a => `<div><span>موضوع: ${e(a.category)} · ${e(a.title)}</span><strong>${cash(a.amount)}</strong></div>`).join('') || '<p>کمک موردی اضافه نشده است.</p>'}</div></article>`;
        }
        function receipt(s) { return `<aside class="mn-receipt"><div class="mn-receipt-icon" aria-hidden="true">▤</div><h3>جمع کل ماهیانهٔ رابط</h3><p>${e(data.liaisonName)} · ${months[month - 1]} ${fmt(year)}</p><div class="mn-line"><span>خانواده‌های این فهرست</span><b>${fmt(s.families.length)} خانواده</b></div><div class="mn-line"><span>تعداد سرپرست‌ها</span><b>${fmt(s.groups.length)}</b></div><p>مجموع واریزی هر سرپرست</p><p class="mn-note">واریزی هر خانواده، جداگانه به سرپرست انجام می‌شود.</p>${s.groups.map(g => `<section class="mn-supervisor-receipt"><div class="mn-line"><span>${e(g.supervisorName)}<small>${fmt(g.families.length)} خانواده</small></span><b>${cash(g.totalAmount)}</b></div>${g.families.map(familyReceipt).join('')}</section>`).join('')}<div class="mn-line"><span>جمع مبالغ ثابت ماهیانه</span><b>${cash(s.base)}</b></div><section class="mn-extra-details"><h4>جزئیات کمک‌های موردی</h4>${s.families.flatMap(f => f.extras.map(a => `<article><b>خانوادهٔ ${e(f.familyName)}</b><small>سرپرست: ${e(f.supervisorName)}</small><p>موضوع: ${e(a.category)} · ${e(a.title)}</p><strong>${cash(a.amount)}</strong></article>`)).join('') || '<p>کمک موردی به صورت‌حساب افزوده نشده است.</p>'}</section><div class="mn-grand"><p>مجموع واریزی همهٔ خانواده‌ها</p><strong data-mn-grand>${fmt(s.total)}</strong><small>تومان</small></div><button type="button" data-mn-image ${!s.families.length?'disabled':''}>دانلود فاکتور PNG</button><div class="mn-export-results" aria-live="polite"></div><p class="mn-note">ثبت این فهرست، درخواست مالی است و به معنی تأیید یا انتقال وجه نیست.</p>${data.status === 'submitted' ? '<div class="mn-success">درخواست این دوره ثبت شده است.</div>' : `<button class="mn-primary" type="button" data-mn-review ${!s.families.length || s.families.some(f => f.baseAmount === null || f.conflict) ? 'disabled' : ''}>${review ? 'تأیید و ثبت درخواست ماهیانه' : 'مرور صورت‌حساب‌ها'}</button><button type="button" data-mn-save>ذخیرهٔ پیش‌نویس</button>${review ? '<button type="button" data-mn-edit>بازگشت به ویرایش</button>' : ''}`}</aside>`; }
        function invoice(g) { const visible = g.families.filter(f => !query || `${f.familyName} ${f.caseNumber} ${g.supervisorName}`.includes(query)); if (!visible.length)
            return ''; return `<article class="mn-invoice"><header><div><small>درخواست مالی ماهیانه · ${months[month - 1]} ${fmt(year)}</small><h3>نام سرپرست: ${e(g.supervisorName)}</h3><p>ماهیانهٔ خانواده‌های تحت پوشش (${fmt(g.families.length)} خانواده)</p></div><div><span class="mn-success">همه در فهرست ✓</span><button type="button" class="mn-group-image" data-mn-group-image="${e(g.supervisorId || 'unassigned')}">دانلود عکس فاکتور سرپرست</button></div></header><div class="mn-table-wrap"><table><thead><tr><th>خانواده</th><th>ماهیانه <small>تومان</small></th><th>موردی <small>تومان</small></th><th>مبلغ واریزی <small>تومان</small></th></tr></thead><tbody>${visible.map(f => `<tr><th scope="row">${e(f.familyName)}<small>پرونده ${e(f.caseNumber)}</small>${f.conflict ? '<em>این دوره قبلاً ثبت شده</em>' : ''}</th><td>${f.baseAmount === null ? '<em>مبلغ تعیین نشده</em>' : fmt(f.baseAmount)}</td><td>${f.extraAmount ? fmt(f.extraAmount) : '—'}</td><td><b>${fmt(f.totalAmount)}</b></td></tr>${f.aids.length ? `<tr><td colspan="4"><div class="mn-aid-grid">${f.aids.map(a => `<label class="mn-aid ${selected.has(a.id) ? 'is-selected' : ''}"><input type="checkbox" data-mn-aid="${e(a.id)}" ${selected.has(a.id) ? 'checked' : ''} ${review || data.status === 'submitted' ? 'disabled' : ''}><span><b>${e(a.title)}</b><small>خانوادهٔ ${e(f.familyName)} · ${e(a.category)}</small><small>تأییدشده${data.status === 'submitted' ? '' : ' و پرداخت‌نشده'}</small></span><strong>${cash(a.amount)}</strong></label>`).join('')}</div></td></tr>` : ''}`).join('')}</tbody></table></div><footer><span>مجموع واریزی سرپرست <small>جمع همهٔ خانواده‌های این سرپرست، مستقل از جست‌وجو</small></span><strong>${cash(g.totalAmount)}</strong></footer></article>`; }
        function render() {
            if (!active())
                return;
            clearImages();
            const s = data ? sums() : null;
            root.innerHTML = `<header class="mn-top"><div><img src="${logo()}" alt="نشان خیریه"><span>سامانهٔ مدیریت خانواده‌ها / ثبت ماهیانه</span></div><button type="button" data-mn-close aria-label="بستن فرم ماهیانه">×</button></header><section class="mn-hero"><small>فهرست کامل رابط، صورت‌حساب جدا برای هر سرپرست</small><h2 id="monthlyRequestTitle">درخواست مالی ماهیانه</h2><p>تمام خانواده‌ها در فهرست هستند؛ کمک‌های موردی تأییدشده را به صورت‌حساب همان خانواده اضافه کنید.</p></section>${controls()}<div class="mn-message" role="alert" tabindex="-1"></div>${data ? `<div class="mn-coverage">✓ ${fmt(s.families.length)} خانواده · ${fmt(s.groups.length)} سرپرست · هیچ خانواده‌ای با جست‌وجو یا فیلتر از درخواست حذف نمی‌شود.${data.status === 'submitted' ? ' · نسخهٔ ثبت‌شده (فقط مشاهده)' : ''}</div>${data.draftChanged ? '<p class="mn-warning">وضعیت برخی کمک‌های پیش‌نویس تغییر کرده و از انتخاب خارج شده‌اند؛ مبالغ را دوباره بررسی کنید.</p>' : ''}${s.families.some(f => f.baseAmount === null || f.conflict) ? '<p class="mn-warning">ثبت نهایی تا اصلاح مبلغ‌های نامشخص یا درخواست‌های تکراری ممکن نیست. مبلغ صفرِ صریح قابل ثبت است.</p>' : ''}${review ? '<div class="mn-warning">مرور نهایی: همهٔ خانواده‌ها و جزئیات موردی‌ها را بررسی کنید؛ تأیید، درخواست‌های ثابت را برای بررسی مالی ثبت می‌کند.</div>' : ''}<div class="mn-layout"><main><div class="mn-filters"><label>جست‌وجوی سرپرست یا خانواده<input data-mn-query placeholder="نام خانواده، سرپرست یا شماره پرونده…" value="${e(query)}"></label><label>سرپرست<select data-mn-supervisor><option value="">همهٔ سرپرست‌ها</option>${s.groups.map(g => `<option value="${e(g.supervisorId || 'unassigned')}" ${supervisor === (g.supervisorId || 'unassigned') ? 'selected' : ''}>${e(g.supervisorName)}</option>`).join('')}</select></label></div><div class="mn-invoices">${s.groups.filter(g => !supervisor || (g.supervisorId || 'unassigned') === supervisor).map(invoice).join('') || '<p class="mn-empty">موردی با این جست‌وجو یافت نشد؛ کل فهرست همچنان محفوظ است.</p>'}</div></main>${receipt(s)}</div>` : '<p class="mn-empty">رابط و دوره را انتخاب کنید.</p>'}`;
            root.setAttribute('aria-labelledby', 'monthlyRequestTitle');
            root.querySelector('[data-mn-close]').onclick = close;
            root.querySelector('[data-mn-load]').onclick = () => { if (dirty && !confirm('تغییرات ذخیره نشده‌اند؛ دوره عوض شود؟'))
                return; liaisonId = root.querySelector('[data-mn-liaison]').value; year = Number(root.querySelector('[data-mn-year]').value); month = Number(root.querySelector('[data-mn-month]').value); query = ''; supervisor = ''; load(); };
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
            message(errors[err.data?.error] || 'دریافت فهرست انجام نشد؛ دوره و اتصال را بررسی و دوباره تلاش کنید.');
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
            if (!liaisons.some(l => l.id === liaisonId))
                liaisonId = liaisons[0]?.id || '';
            render();
            if (liaisonId)
                await load();
            if (active())
                root.querySelector('[data-mn-close]')?.focus();
        }
        catch {
            if (active()) {
                render();
                message('دریافت رابط‌ها انجام نشد؛ فرم را ببندید و دوباره باز کنید.');
            }
        }
    };
})();
