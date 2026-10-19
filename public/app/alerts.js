/* Feature: alerts. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const alertSeverityNames = { info: 'اطلاع‌رسانی', important: 'مهم', urgent: 'فوری', critical: 'بحرانی' }, alertTypeNames = { weekly_due: 'موعد گزارش هفتگی', weekly_overdue: 'گزارش هفتگی عقب‌افتاده', weekly_pending_review: 'گزارش منتظر تأیید', weekly_revision_requested: 'گزارش برگشتی برای اصلاح', action_due_soon: 'اقدام نزدیک مهلت', action_overdue: 'اقدام عقب‌افتاده', action_result_pending: 'نتیجه منتظر تأیید', referral_no_response: 'ارجاع بدون پاسخ', budget_low: 'بودجه رو به اتمام', financial_stale: 'درخواست مالی معطل', document_expiry: 'انقضای سند', followup_due: 'موعد پیگیری', insurance_renewal: 'تمدید بیمه', rent_renewal: 'تمدید اجاره' };

async function refreshAlertBadge() { try {
    const d = await api('/api/alerts?includeRead=false'), b = $('#alertBadge'), trigger = $('#alertsBtn');
    if (!b)
        return;
    b.textContent = fa(d.unread);
    b.classList.toggle('hidden', !d.unread);
    b.style.background = d.counts.critical ? 'var(--red-soft)' : d.counts.urgent ? '#fff0df' : 'var(--blue-soft)';
    if (trigger) {
        const label = d.unread ? `مرکز پیگیری، ${fa(d.unread)} هشدار خوانده‌نشده` : 'مرکز پیگیری';
        trigger.setAttribute('aria-label', label);
        trigger.title = label;
        trigger.classList.toggle('has-critical', Boolean(d.counts.critical));
    }
}
catch { } }

function alertDate(value) { if (!value)
    return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date); }

async function openAlerts(severity = '', unreadOnly = false) {
    try {
        const params = new URLSearchParams();
        if (severity)
            params.set('severity', severity);
        if (unreadOnly)
            params.set('includeRead', 'false');
        const d = await api('/api/alerts?' + params), counts = d.counts || {}, alerts = d.alerts || [], modalRoot = $('#modalRoot');
        const filters = [['all', 'همه', d.total || 0], ['unread', 'خوانده‌نشده', d.unread || 0], ...['critical', 'urgent', 'important', 'info'].map(key => [key, alertSeverityNames[key], counts[key] || 0])];
        const filterButtons = filters.map(([key, label, count]) => { const active = key === 'all' && !severity && !unreadOnly || key === 'unread' && !severity && unreadOnly || key === severity; const attrs = key === 'all' ? 'data-alert-all' : key === 'unread' ? 'data-alert-unread' : `data-alert-filter="${key}"`; return `<button type="button" class="alert-filter ${active ? 'is-active' : ''}" ${attrs} aria-pressed="${active}"><span>${label}</span><b>${fa(count)}</b></button>`; }).join('');
        const rows = alerts.map(a => `<article class="alert-record severity-${esc(a.severity)} ${a.read ? 'is-read' : ''}"><span class="alert-record-edge" aria-hidden="true"></span><div class="alert-record-content"><div class="alert-record-meta"><span class="alert-severity-pill severity-${esc(a.severity)}"><i></i>${esc(alertSeverityNames[a.severity] || a.severity)}</span><span class="alert-type-label">${esc(alertTypeNames[a.type] || a.type)}</span><span class="alert-read-state ${a.read ? 'is-read' : ''}">${a.read ? 'خوانده‌شده' : 'جدید'}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.message)}</p>${a.dueAt || a.createdAt ? `<div class="alert-record-date">${a.dueAt ? 'موعد' : 'ثبت'}: ${esc(alertDate(a.dueAt || a.createdAt))}</div>` : ''}<div class="alert-record-actions">${a.familyId ? `<button type="button" class="primary" data-open-alert="${encodeURIComponent(a.key)}" data-alert-family="${esc(a.familyId)}">مشاهده پرونده <span aria-hidden="true">←</span></button>` : `<button type="button" class="secondary" data-read-alert="${encodeURIComponent(a.key)}">علامت‌گذاری به‌عنوان خوانده‌شده</button>`}<button type="button" class="alert-dismiss" data-dismiss-alert="${encodeURIComponent(a.key)}">بستن هشدار</button></div></div></article>`).join('');
        const canEditSettings = actor?.role === 'admin' || actor?.position === 'ceo';
        modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal alert-center-modal" role="dialog" aria-modal="true" aria-labelledby="alertCenterTitle"><header class="alert-center-head"><div class="alert-center-title"><span class="alert-center-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><div><small>C.6 · مرکز اعلان‌ها</small><h2 id="alertCenterTitle">هشدارها و پیگیری خودکار</h2><p>موارد مهم را مرور کنید و وضعیت هر هشدار را مدیریت کنید.</p></div></div><div class="alert-center-head-actions">${canEditSettings ? '<button type="button" class="alert-settings-trigger" id="alertSettingsBtn"><span aria-hidden="true">⚙</span> تنظیم آستانه‌ها</button>' : ''}<button class="close-btn" data-close aria-label="بستن هشدارها">×</button></div></header><div class="alert-center-summary"><div><span>خوانده‌نشده</span><b>${fa(d.unread || 0)}</b></div><div><span>فوری و بحرانی</span><b>${fa((counts.urgent || 0) + (counts.critical || 0))}</b></div><div><span>در این فهرست</span><b>${fa(d.total || 0)}</b></div></div><div class="alert-filter-wrap"><div class="alert-filter-heading"><b>فیلتر هشدارها</b><span>برای محدودکردن فهرست، یک گزینه را انتخاب کنید.</span></div><div class="alert-filter-menu" role="toolbar" aria-label="فیلتر هشدارها">${filterButtons}</div></div><div class="alert-list-heading"><h3>فهرست هشدارها</h3><span class="count-chip">${fa(alerts.length)} مورد</span></div><div class="alert-record-list">${rows || `<div class="alert-empty"><span aria-hidden="true">✓</span><b>هشداری برای نمایش نیست</b><p>${severity || unreadOnly ? 'با این فیلتر موردی پیدا نشد.' : 'در حال حاضر هشدار فعالی ثبت نشده است.'}</p></div>`}</div></section></div>`;
        const root = modalRoot.querySelector('.modal-backdrop');
        root.addEventListener('click', e => { if (e.target === root)
            closeModal(); });
        modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
        modalRoot.querySelectorAll('[data-alert-filter]').forEach(b => b.onclick = () => openAlerts(b.dataset.alertFilter, unreadOnly));
        modalRoot.querySelector('[data-alert-all]')?.addEventListener('click', () => openAlerts());
        modalRoot.querySelector('[data-alert-unread]')?.addEventListener('click', () => openAlerts('', true));
        const settings = modalRoot.querySelector('#alertSettingsBtn');
        if (settings)
            settings.onclick = () => openAlertSettings(severity, unreadOnly);
        modalRoot.querySelectorAll('[data-open-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.openAlert + '/read', { method: 'POST', body: '{}' });
            refreshAlertBadge();
            openFamilyRecord(b.dataset.alertFamily);
        }
        catch (e) {
            toast(e.message);
        } });
        modalRoot.querySelectorAll('[data-read-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.readAlert + '/read', { method: 'POST', body: '{}' });
            await openAlerts(severity, unreadOnly);
            refreshAlertBadge();
        }
        catch (e) {
            toast(e.message);
        } });
        modalRoot.querySelectorAll('[data-dismiss-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.dismissAlert + '/dismiss', { method: 'POST', body: '{}' });
            await openAlerts(severity, unreadOnly);
            refreshAlertBadge();
        }
        catch (e) {
            toast(e.message);
        } });
    }
    catch (e) {
        toast(e.message);
    }
}

async function openAlertSettings(severity = '', unreadOnly = false) {
    try {
        const { settings: x } = await api('/api/alerts/settings'), modalRoot = $('#modalRoot');
        const fields = [['actionDueSoonDays', 'هشدار اقدام نزدیک موعد', 'روز پیش از سررسید', 1, 30], ['referralNoResponseHours', 'ارجاع بدون پاسخ', 'ساعت', 1, 720], ['financeStaleDays', 'درخواست مالی معطل', 'روز', 1, 30], ['budgetWarningPercent', 'هشدار کاهش بودجه', 'درصد مانده', 1, 99], ['budgetCriticalPercent', 'وضعیت بحرانی بودجه', 'درصد مانده', 0, 98], ['documentExpiryDays', 'نزدیکی انقضای سند', 'روز پیش از انقضا', 1, 90]];
        modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal alert-settings-modal" role="dialog" aria-modal="true" aria-labelledby="alertSettingsTitle"><header class="alert-center-head"><div><small>تنظیمات هشدار</small><h2 id="alertSettingsTitle">آستانه‌های یادآوری</h2><p>مشخص کنید سامانه از چه زمانی هشدار ایجاد کند.</p></div><button class="close-btn" data-close aria-label="بازگشت به هشدارها">×</button></header><form id="alertSettingsForm"><div class="alert-settings-grid">${fields.map(([name, label, hint, min, max]) => `<label class="alert-setting-field"><span>${label}<small>${hint}</small></span><input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${esc(x[name])}" required></label>`).join('')}</div><p class="alert-settings-note">آستانهٔ بحرانی بودجه باید از آستانهٔ هشدار کمتر باشد.</p><div id="alertSettingsError" class="message error" aria-live="polite"></div><div class="alert-settings-actions"><button type="button" class="secondary" id="backToAlerts">بازگشت</button><button type="submit" class="primary">ذخیرهٔ تنظیمات</button></div></form></section></div>`;
        modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = () => openAlerts(severity, unreadOnly));
        modalRoot.querySelector('#backToAlerts').onclick = () => openAlerts(severity, unreadOnly);
        modalRoot.querySelector('#alertSettingsForm').onsubmit = async (e) => { e.preventDefault(); const form = e.currentTarget, values = Object.fromEntries(new FormData(form)); for (const key of Object.keys(values))
            values[key] = Number(values[key]); const error = modalRoot.querySelector('#alertSettingsError'); if (values.budgetCriticalPercent >= values.budgetWarningPercent) {
            error.textContent = 'آستانهٔ بحرانی باید از آستانهٔ هشدار کمتر باشد.';
            return;
        } const button = form.querySelector('[type="submit"]'); button.disabled = true; try {
            await api('/api/alerts/settings', { method: 'PUT', body: JSON.stringify(values) });
            toast('تنظیمات هشدار ذخیره شد.');
            await openAlerts(severity, unreadOnly);
        }
        catch (err) {
            error.textContent = err.message;
            button.disabled = false;
        } };
    }
    catch (e) {
        toast(e.message);
    }
}

async function openFinancialInbox() { try {
    const d = await api('/api/financial-cases/inbox');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">C.5</div><h2>کارتابل ${d.mode === 'finance' ? 'پرداخت' : 'تأیید مالی'}</h2></div><button class="close-btn" data-close>×</button></div>${d.items.map(x => `<button class="family-item" data-fin-family="${x.familyId}"><div class="family-item-head"><b>${esc(x.title)}</b><span class="finance-status ${financeStatusClass(x.status)}">${esc(x.status)}</span></div><p>${esc(x.caseNumber)} · ${esc(x.headName)} · ${money(x.approvedAmount || x.amount)} تومان · ${esc(sourceTypeNames[x.sourceType] || x.sourceType)}</p></button>`).join('') || '<div class="empty-state">موردی در کارتابل نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-fin-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.finFamily); });
}
catch (e) {
    toast(e.message);
} }
