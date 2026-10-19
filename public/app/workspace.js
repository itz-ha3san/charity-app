/* Feature: workspace. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const auditLabels = { 'family.tag.assign': 'افزودن برچسب', 'family.tag.remove': 'حذف برچسب', 'financial.source.create': 'درخواست مالی از منبع', 'financial.document.upload': 'بارگذاری مدرک مالی', 'financial.document.download': 'مشاهده مدرک مالی', 'specialist.create': 'تشکیل پرونده تخصصی', 'specialist.update': 'به‌روزرسانی پرونده تخصصی', 'specialist.transition': 'تغییر مرحله پرونده تخصصی', 'specialist.document.upload': 'بارگذاری مدرک تخصصی', 'specialist.document.download': 'مشاهده مدرک تخصصی', 'action.propose': 'پیشنهاد اقدام', 'action.assign': 'تخصیص اقدام', 'action.complete': 'اعلام انجام اقدام', 'action.review': 'بررسی نتیجه اقدام', 'action.cancel': 'لغو اقدام', 'supervision.report.create': 'ایجاد گزارش هفتگی', 'supervision.report.submit': 'ارسال گزارش هفتگی', 'supervision.report.review': 'بررسی گزارش هفتگی', 'supervisor.create': 'ایجاد سرپرست', 'supervisor.update': 'ویرایش سرپرست', 'family.supervisor.assign': 'تخصیص سرپرست', 'family.referral.create': 'ارجاع تخصصی', 'family.referral.update': 'تغییر وضعیت ارجاع', 'financial.transition': 'تغییر وضعیت مالی', 'financial.payment': 'ثبت پرداخت', 'family.create': 'ایجاد پرونده', 'family.update': 'ویرایش پرونده', 'family.import': 'ورود از فایل JSON', 'family.profile.update': 'تکمیل اطلاعات کامل', 'family.archive': 'آرشیو پرونده', 'family.unarchive': 'بازگردانی پرونده', 'financial.create': 'ثبت درخواست مالی', 'financial.update': 'ویرایش مورد مالی', 'note.create': 'افزودن یادداشت', 'note.update': 'ویرایش پیگیری', 'document.upload': 'بارگذاری سند', 'document.delete': 'حذف سند', 'document.replace': 'جایگزینی سند' };

const auditIcons = { 'supervision.report.create': '＋', 'supervision.report.submit': '→', 'supervision.report.review': '✓', 'supervisor.create': '＋', 'supervisor.update': '✎', 'family.supervisor.assign': '⇄', 'family.referral.create': '→', 'family.referral.update': '↻', 'financial.transition': '→', 'financial.payment': '✓', 'family.create': '＋', 'family.update': '✎', 'family.import': '⇩', 'family.profile.update': '◆', 'family.archive': '×', 'family.unarchive': '↻', 'financial.create': '﷼', 'financial.update': '₮', 'note.create': '✎', 'note.update': '↻', 'document.upload': '↑', 'document.delete': '×', 'document.replace': '⇄' };

function auditDetailItems(d = {}) { const items = []; if (d.changedFields?.length)
    items.push('فیلدهای تغییرکرده: ' + d.changedFields.map(label).join('، ')); if (d.memberCount !== undefined)
    items.push('اعضا: ' + fa(d.memberCount) + ' نفر'); if (d.fieldCount !== undefined)
    items.push('فیلدهای کامل: ' + fa(d.fieldCount)); if (d.source)
    items.push('منبع: ' + (d.source === 'json' ? 'فایل JSON' : d.source)); if (d.amount !== undefined)
    items.push('مبلغ: ' + fa(d.amount) + ' تومان'); if (d.status)
    items.push('وضعیت: ' + d.status); if (d.title)
    items.push('عنوان: ' + d.title); return items; }

function renderAuditEvent(e) { const d = e.details || {}, action = auditLabels[e.action] || e.action, kind = e.action === 'family.archive' ? 'archive' : e.action === 'family.unarchive' ? 'restore' : '', date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.createdAt)), items = auditDetailItems(d); return `<article class="audit-event"><div class="audit-dot ${kind}">${auditIcons[e.action] || '•'}</div><div class="audit-card"><div class="audit-card-head"><div><h4>${esc(action)}</h4><div class="audit-meta">توسط ${esc(e.actorName || e.actorUsername || 'کاربر حذف‌شده')}</div></div><time class="audit-meta" datetime="${esc(e.createdAt)}">${esc(date)}</time></div>${items.length ? `<div class="audit-details">${items.map(x => `<span class="audit-detail">${esc(x)}</span>`).join('')}</div>` : ''}${d.reason ? `<p class="audit-reason"><b>دلیل:</b> ${esc(d.reason)}</p>` : ''}</div></article>`; }

async function openAuditLog(f) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">گزارش غیرقابل‌ویرایش</div><h2>تاریخچه فعالیت پرونده ${esc(f.caseNumber)}</h2></div><button class="close-btn" data-close>×</button></div><div id="auditBody"><div class="panel-loading"><div><div class="spinner"></div>در حال دریافت تاریخچه…</div></div></div></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); try {
    const data = await api('/api/families/' + encodeURIComponent(f.id) + '/audit?limit=100');
    $('#auditBody').innerHTML = `<div class="audit-summary"><span class="count-chip">${fa(data.total)} رویداد</span><span class="muted">جدیدترین فعالیت ابتدا نمایش داده می‌شود.</span></div>${data.events.length ? `<div class="audit-timeline">${data.events.map(renderAuditEvent).join('')}</div>` : '<div class="audit-empty">هنوز فعالیتی برای این پرونده ثبت نشده است.</div>'}`;
}
catch (e) {
    $('#auditBody').innerHTML = `<div class="audit-empty">دریافت تاریخچه ناموفق بود.<br>${esc(e.message)}</div>`;
} }

function closeModal() { AppUI.mountModal(''); importPayload = null; $('#importFile').value = ''; }

function openPreview(data, name) { const families = data?.families; if (!Array.isArray(families) || !families.length)
    throw Error('فایل باید شامل آرایه families باشد.'); const f = families[0]; importPayload = { families }; AppUI.mountModal(`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">پیش‌نمایش ورود</div><h2>${esc(name)}</h2></div><button class="close-btn" data-close>×</button></div><p class="muted">${fa(families.length)} پرونده پس از اعتبارسنجی، در یک Transaction ثبت می‌شود.</p><div class="import-preview">${[['اولین خانوار', f.headName || f.familySurname], ['شماره پرونده', f.caseNumber], ['تعداد اعضا', fa((f.members || []).length) + ' نفر'], ['کد ملی فرد اصلی خانوار', f.headNationalId]].map(x => `<div class="info-card"><span>${x[0]}</span><b>${esc(x[1] || 'ثبت نشده')}</b></div>`).join('')}</div><div id="importError" class="message error"></div><div class="modal-actions"><button id="confirmImport" class="primary">تأیید و ورود به PostgreSQL</button><button class="secondary" data-close>انصراف</button></div></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#confirmImport').onclick = confirmImport; }

async function confirmImport() { const b = $('#confirmImport'); b.disabled = true; b.classList.add('button-loading'); try {
    const result = await api('/api/families/import', { method: 'POST', body: JSON.stringify(importPayload) }), id = result.ids[0];
    closeModal();
    toast(fa(result.imported) + ' پرونده با موفقیت وارد شد.');
    selectedId = id;
    await loadFamilies();
    if (id)
        await loadDetail(id);
}
catch (e) {
    b.disabled = false;
    b.classList.remove('button-loading');
    $('#importError').textContent = e.message;
} }

async function openActionInbox() { try {
    const d = await api('/api/actions/inbox');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">C.3</div><h2>کارتابل اقدامات</h2></div><button class="close-btn" data-close>×</button></div>${d.items.map(x => `<button class="family-item" data-action-family="${x.familyId}"><div class="family-item-head"><b>${esc(x.title)}</b><span class="status">${esc(actionStatusNames[x.status] || x.status)}</span></div><p>پرونده ${esc(x.caseNumber)} · ${esc(x.headName)} ${x.dueAt ? '· مهلت ' + esc(x.dueAt) : ''}</p></button>`).join('') || '<div class="empty-state">اقدامی در کارتابل نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-action-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.actionFamily); });
}
catch (e) {
    toast(e.message);
} }

async function openApprovalQueue() { try {
    const d = await api('/api/approvals/families'), rows = [...d.newFamilies.map(x => ({ ...x, kind: 'create' })), ...d.changes.map(x => ({ ...x, kind: 'change' }))];
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">نیازمند تصمیم سطح بالاتر</div><h2>کارتابل تأییدها</h2></div><button class="close-btn" data-close>×</button></div>${rows.map(x => `<div class="user-row"><div><b>${esc(x.headName)} · پرونده ${esc(x.caseNumber)}</b><p>${x.kind === 'create' ? 'ایجاد خانواده' : 'ویرایش اطلاعات'} توسط ${esc(x.requestedBy || 'رابط')}</p></div><div class="doc-actions"><button class="primary" data-review="${x.id}" data-kind="${x.kind}" data-decision="approve">تأیید</button><button class="danger" data-review="${x.id}" data-kind="${x.kind}" data-decision="reject">رد</button></div></div>`).join('') || '<div class="empty-state">موردی در انتظار تأیید نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-review]').forEach(b => b.onclick = async () => { const note = prompt(b.dataset.decision === 'approve' ? 'دلیل تأیید:' : 'دلیل رد:'); if (!note || note.trim().length < 3)
        return; const url = b.dataset.kind === 'create' ? '/api/families/' + b.dataset.review + '/review' : '/api/family-change-requests/' + b.dataset.review + '/review'; await api(url, { method: 'POST', body: JSON.stringify({ decision: b.dataset.decision, note }) }); toast('تصمیم ثبت شد.'); openApprovalQueue(); loadFamilies(); });
}
catch (e) {
    toast(e.message);
} }

function openShortcutHub(eyebrow, title, description, items) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-backdrop"><section class="modal shortcut-hub-modal" role="dialog" aria-modal="true" aria-labelledby="shortcutHubTitle"><header class="shortcut-hub-head"><div><small>${esc(eyebrow)}</small><h2 id="shortcutHubTitle">${esc(title)}</h2><p>${esc(description)}</p></div><button class="close-btn" type="button" data-close aria-label="بستن">×</button></header><div class="shortcut-hub-grid">${items.map((item, index) => `<button type="button" class="shortcut-hub-item" data-hub-index="${index}"><span class="shortcut-hub-icon" aria-hidden="true">${esc(item.icon || '←')}</span><span class="shortcut-hub-copy"><b>${esc(item.label)}</b><small>${esc(item.description)}</small></span>${item.badge ? `<span class="shortcut-hub-badge">${esc(item.badge)}</span>` : '<span class="shortcut-hub-arrow" aria-hidden="true">←</span>'}</button>`).join('')}</div></section></div>`;
    root.querySelectorAll('[data-close]').forEach(button => button.onclick = closeModal);
    root.querySelectorAll('[data-hub-index]').forEach(button => button.onclick = () => { const action = items[Number(button.dataset.hubIndex)]?.run; closeModal(); if (action)
        setTimeout(action, 30); });
    root.querySelector('.modal-backdrop')?.addEventListener('click', event => { if (event.target === event.currentTarget)
        closeModal(); });
}

function openWorkQueuesHub() {
    const role = actor?.role, position = actor?.position, isAdmin = role === 'admin', items = [];
    const badge = $('#alertBadge'), unread = badge && !badge.classList.contains('hidden') ? badge.textContent.trim() : '';
    items.push({ label: 'هشدارهای سامانه', description: 'تمدیدها، موارد مهم و اعلان‌های تازه', icon: '!', badge: unread, run: () => openAlerts() });
    items.push({ label: 'پیگیری‌های عقب‌افتاده', description: 'مواردی که موعد رسیدگی آن‌ها گذشته است', icon: '◷', run: () => openOverdue() });
    if (isAdmin || role === 'caseworker')
        items.push({ label: 'اقدامات پرونده', description: 'مشاهده و انجام کارهای ارجاع‌شده', icon: '✓', run: () => openActionInbox() });
    if (isAdmin || ['health_officer', 'education_officer', 'ceo', 'supervision_deputy', 'health_deputy', 'education_deputy'].includes(position))
        items.push({ label: 'ارجاع‌های تخصصی', description: 'کارتابل ارجاع‌های درمانی و آموزشی', icon: '＋', run: () => openSpecialistInbox() });
    if (elevatedFinancial())
        items.push({ label: 'تأییدهای در انتظار', description: 'درخواست‌های منتظر تصمیم مدیریتی', icon: '✓', run: () => openApprovalQueue() });
    if (isAdmin || position === 'liaison' || position === 'supervision_deputy')
        items.push({ label: 'پیگیری سرپرستی', description: 'گزارش‌ها و موارد نیازمند بررسی سرپرست', icon: '↗', run: () => openSupervisionInbox() });
    openShortcutHub('مرکز رسیدگی', 'پیگیری و کارتابل‌ها', 'کارهای مشابه در یک نقطه جمع شده‌اند؛ گزینهٔ موردنظر را انتخاب کنید.', items);
}

function openFinanceHub() {
    const role = actor?.role, position = actor?.position, isAdmin = role === 'admin', items = [];
    if (isAdmin || role === 'accountant' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_officer'].includes(position))
        items.push({ label: 'درخواست‌های مالی', description: 'کارتابل تأیید و پرداخت درخواست‌ها', icon: '▤', run: () => openFinancialInbox() });
    if (isAdmin || role === 'accountant' || ['ceo', 'finance_officer'].includes(position))
        items.push({ label: 'گزارش مالی', description: 'داشبورد مالی و گزارش‌های پرداخت', icon: '▥', run: () => openC7Dashboard('finance') });
    openShortcutHub('امور مالی', 'مرکز مالی', 'دسترسی‌های مالی مرتبط با سمت شما.', items);
}

async function openLiaisonMessageComposer() {
    if (!(actor?.role === 'admin' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_deputy'].includes(actor?.position)))
        return toast('دسترسی ارسال پیام برای شما فعال نیست.');
    try {
        const [directory, families] = await Promise.all([api('/api/messages/recipients'), api('/api/families?status=active&limit=100&offset=0')]);
        const recipients = directory.recipients || [], familyOptions = (families.families || []).map(f => `<option value="${esc(f.id)}">${esc(f.caseNumber)} · ${esc(f.headName)}</option>`).join('');
        AppUI.mountModal(`<div class="modal-backdrop"><section class="modal liaison-message-modal" role="dialog" aria-modal="true"><header class="modal-head"><div><span class="eyebrow">پیام داخلی سامانه</span><h2>ارسال پیام به رابط‌ها</h2><p class="muted">پیام در نمای امروز رابط نمایش داده می‌شود و در صندوق او باقی می‌ماند.</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></header><form id="liaisonMessageForm"><div class="form-grid"><div class="form-field full"><label>عنوان پیام *</label><input name="title" maxlength="180" required placeholder="مثلاً تکمیل گزارش این هفته"></div><div class="form-field full"><label>متن پیام *</label><textarea name="body" maxlength="5000" minlength="3" required placeholder="دستور یا توضیح لازم را روشن و کوتاه بنویسید"></textarea></div><div class="form-field"><label>اهمیت</label><select name="severity"><option value="important">مهم</option><option value="urgent">فوری</option><option value="critical">بحرانی</option></select></div><div class="form-field"><label>پروندهٔ مرتبط (اختیاری)</label><select name="familyId"><option value="">بدون پیوند به پرونده</option>${familyOptions}</select></div><div class="form-field full liaison-recipient-panel"><div class="liaison-recipient-head"><label><input type="checkbox" name="allLiaisons"> ارسال به همهٔ رابط‌های فعال</label><span>${fa(recipients.length)} رابط فعال</span></div><div class="liaison-recipient-list">${recipients.map(u => `<label><input type="checkbox" name="recipientId" value="${esc(u.id)}"><span>${esc(u.name)}</span></label>`).join('') || '<div class="empty-state">رابط فعالی برای دریافت پیام وجود ندارد.</div>'}</div></div><div class="form-field full"><label class="liaison-ack-option"><input type="checkbox" name="acknowledgementRequired"> از رابط بخواهید دریافت پیام را تأیید کند</label></div></div><div id="liaisonMessageError" class="message error" role="alert"></div><div class="modal-actions"><button type="submit" class="primary">ارسال پیام</button><button type="button" class="secondary" data-close>انصراف</button></div></form></section></div>`);
        document.querySelectorAll('#modalRoot [data-close]').forEach(b => b.onclick = closeModal);
        const form = $('#liaisonMessageForm'), all = form.elements.allLiaisons, family = form.elements.familyId, recipientBoxes = [...form.querySelectorAll('[name="recipientId"]')];
        const syncRecipients = () => { recipientBoxes.forEach(input => { input.disabled = all.checked; if (all.checked)
            input.checked = false; }); family.disabled = all.checked; if (all.checked)
            family.value = ''; };
        all.onchange = syncRecipients;
        family.onchange = () => { if (family.value && all.checked) {
            all.checked = false;
            syncRecipients();
        } };
        const severity = form.elements.severity, ack = form.elements.acknowledgementRequired;
        severity.onchange = () => { if (severity.value === 'critical') {
            ack.checked = true;
            ack.disabled = true;
        }
        else
            ack.disabled = false; };
        form.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(form), recipientIds = fd.getAll('recipientId').map(String), allLiaisons = fd.get('allLiaisons') === 'on'; if (!allLiaisons && !recipientIds.length) {
            $('#liaisonMessageError').textContent = 'یک رابط یا گزینهٔ همهٔ رابط‌ها را انتخاب کنید.';
            return;
        } const button = form.querySelector('[type="submit"]'); button.disabled = true; try {
            const result = await api('/api/messages', { method: 'POST', body: JSON.stringify({ title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), severity: String(fd.get('severity') || 'important'), acknowledgementRequired: fd.get('acknowledgementRequired') === 'on', recipientIds, allLiaisons, familyId: String(fd.get('familyId') || '') || null }) });
            closeModal();
            toast(`پیام برای ${fa(result.recipientCount)} رابط ارسال شد.`);
        }
        catch (err) {
            $('#liaisonMessageError').textContent = err.data?.error === 'FAMILY_NOT_ASSIGNED_TO_RECIPIENTS' ? 'این خانواده به همهٔ رابط‌های انتخاب‌شده اختصاص ندارد؛ گیرندگان مرتبط را جداگانه انتخاب کنید.' : err.message;
            button.disabled = false;
        } };
    }
    catch (err) {
        toast(err.message);
    }
}

function openManagementHub() {
    const role = actor?.role, position = actor?.position, isAdmin = role === 'admin', items = [];
    if (isAdmin || position === 'ceo')
        items.push({ label: 'داشبورد مدیرعامل', description: 'نمای کلان وضعیت سامانه', icon: '▥', run: () => openC7Dashboard('ceo') });
    if (isAdmin || ['ceo', 'supervision_deputy'].includes(position))
        items.push({ label: 'داشبورد سرپرستی', description: 'وضعیت پیگیری و عملکرد رابط‌ها', icon: '↗', run: () => openC7Dashboard('supervision') });
    if (isAdmin || role === 'accountant' || ['ceo', 'supervision_deputy', 'finance_officer'].includes(position))
        items.push({ label: 'گزارش‌ها', description: 'گزارش‌گیری از پرونده‌ها و حمایت‌ها', icon: '▤', run: () => openDashboardReport() });
    if (isAdmin || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_deputy'].includes(position))
        items.push({ label: 'ارسال پیام به رابط‌ها', description: 'ابلاغ فوری یا مهم به یک یا چند رابط خیریه', icon: '✉', run: () => openLiaisonMessageComposer() });
    if (isAdmin)
        items.push({ label: 'مدیریت کاربران', description: 'حساب‌ها و دسترسی کاربران', icon: '♙', run: () => openUsers() }, { label: 'ورود داده', description: 'مهاجرت گروهی اطلاعات', icon: '⇧', run: () => openMigrationCenter() }, { label: 'وضعیت سامانه', description: 'سلامت و وضعیت اجرای سرویس', icon: '●', run: () => openOpsStatus() });
    openShortcutHub('ابزارهای مدیریتی', 'مدیریت و گزارش‌ها', 'فقط ابزارهای متناسب با سطح دسترسی شما نمایش داده می‌شوند.', items);
}

function setupOpsNav() {
    const old = $('#opsNav');
    if (old)
        old.remove();
    const role = actor?.role, position = actor?.position, isAdmin = role === 'admin';
    const canFinance = isAdmin || role === 'accountant' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_officer'].includes(position);
    const canManage = isAdmin || role === 'accountant' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_officer'].includes(position);
    const nav = document.createElement('div');
    nav.id = 'opsNav';
    nav.className = 'ops-nav';
    nav.innerHTML = `<button class="secondary" id="familiesBtn">خانواده‌ها</button><button class="secondary" id="advancedSearchBtn">جست‌وجوی پیشرفته</button><button class="secondary" id="alertsBtn">مرکز پیگیری <span id="alertBadge" class="count-chip hidden">۰</span></button>${canFinance ? '<button class="secondary" id="financeHubBtn">امور مالی</button>' : ''}${canManage ? '<button class="secondary" id="managementHubBtn">مدیریت و گزارش‌ها</button>' : ''}`;
    document.querySelector('.dashboard-head').after(nav);
    const familiesBtn = $('#familiesBtn');
    if (familiesBtn)
        familiesBtn.onclick = () => document.querySelector('.workspace-family-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const advanced = $('#advancedSearchBtn');
    if (advanced)
        advanced.onclick = openAdvancedFamilySearch;
    const followups = $('#alertsBtn');
    if (followups)
        followups.onclick = openWorkQueuesHub;
    const finances = $('#financeHubBtn');
    if (finances)
        finances.onclick = openFinanceHub;
    const management = $('#managementHubBtn');
    if (management)
        management.onclick = openManagementHub;
    refreshAlertBadge();
}

async function openDashboardReport(filters = {}) { const issues = ReportRules.rangeErrors(filters); if (issues.length) {
    toast(issues[0].message);
    return;
} const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)), [data, assignees] = await Promise.all([api('/api/dashboard?' + query), api('/api/assignees')]); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">نمای مدیریتی</div><h2>داشبورد و گزارش‌ها</h2></div><button class="close-btn" data-close>×</button></div><form id="reportFilter" class="form-grid"><div class="form-field"><label>از تاریخ</label><input type="date" name="from" max="${ReportRules.today()}" value="${esc(filters.from || '')}"></div><div class="form-field"><label>تا تاریخ</label><input type="date" name="to" min="${esc(filters.from || '')}" max="${ReportRules.today()}" value="${esc(filters.to || '')}"></div><div class="form-field"><label>مددکار</label><select name="assigneeId"><option value="">همه</option>${assignees.users.map(u => `<option value="${u.id}" ${filters.assigneeId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div><div class="form-field"><label>نوع کمک</label><select name="category"><option value="">همه</option>${['مسکن', 'درمان', 'تحصیل', 'خوراک', 'اشتغال', 'کمک نقدی', 'سایر'].map(x => `<option ${filters.category === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><button class="secondary" type="submit">اعمال فیلتر</button></form><div class="metric-grid">${[['فعال', data.active], ['آرشیوشده', data.archived], ['فوری', data.urgent], ['عقب‌افتاده', data.overdue]].map(x => `<div class="metric-card"><span>${x[0]}</span><b>${fa(x[1])}</b></div>`).join('')}</div><div class="metric-card"><span>مجموع کمک‌ها در فیلتر فعلی</span><b>${money(data.financialTotal)} تومان</b><small>${fa(data.financialCount)} مورد مالی</small></div><h3>پرونده‌ها بر اساس مسئول</h3><div class="report-bars">${data.byWorker.map(x => `<div class="report-bar"><span>${esc(x.label)}</span><b>${fa(x.value)}</b></div>`).join('')}</div><h3>کمک‌ها بر اساس نوع</h3><div class="report-bars">${data.byCategory.map(x => `<div class="report-bar"><span>${esc(x.label)}</span><b>${money(x.amount)} تومان</b></div>`).join('')}</div><div class="modal-actions" style="margin-top:18px"><a class="primary" href="/api/reports/export?format=excel">خروجی Excel</a><button class="secondary" id="pdfReportBtn">خروجی PDF</button></div></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#reportFilter').onsubmit = e => { e.preventDefault(); openDashboardReport(Object.fromEntries(new FormData(e.currentTarget))); }; $('#pdfReportBtn').onclick = () => window.open('/api/reports/export?format=pdf', '_blank'); }

async function openOverdue() { const data = await api('/api/follow-ups/overdue'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">یادآوری</div><h2>پیگیری‌های عقب‌افتاده</h2></div><button class="close-btn" data-close>×</button></div>${data.items.length ? data.items.map(x => `<button class="family-item overdue-link" data-family="${esc(x.familyId)}"><b>${esc(x.headName)} · پرونده ${esc(x.caseNumber)}</b><p>${esc(x.text)} · ${esc(x.assigneeName || 'بدون مسئول')}</p><small>${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(x.nextFollowUpAt))}</small></button>`).join('') : '<div class="audit-empty">پیگیری عقب‌افتاده‌ای وجود ندارد.</div>'}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); document.querySelectorAll('.overdue-link').forEach(b => b.onclick = () => { const id = b.dataset.family; closeModal(); loadDetail(id); }); }

function renderOverviewFamily(f) { return `<button type="button" class="overview-family-result" data-overview-family="${esc(f.id)}"><span class="overview-family-result-icon" aria-hidden="true">▤</span><span class="overview-family-result-copy"><b>${esc(f.headName || 'نام ثبت نشده')} · پرونده ${esc(f.caseNumber || '—')}</b><small>${esc(f.familySurname || 'نام خانوادگی ثبت نشده')} · ${fa(f.memberCount || 0)} عضو</small></span><span class="overview-family-result-priority">${esc(f.priority || 'ثبت نشده')}</span><span aria-hidden="true">←</span></button>`; }

async function openOverviewFamilyList(kind = 'urgent') {
    const isUrgent = kind === 'urgent', title = isUrgent ? 'پرونده‌های فوری' : 'پرونده‌های فعال', query = new URLSearchParams({ status: 'active', limit: '100' });
    if (isUrgent)
        query.set('priority', 'فوری');
    AppUI.mountModal(`<div class="modal-backdrop"><section class="modal overview-results-modal" role="dialog" aria-modal="true" aria-labelledby="overviewResultsTitle"><header class="overview-results-head"><div><span class="eyebrow">${isUrgent ? 'نیازمند بررسی سریع' : 'در جریان رسیدگی'}</span><h2 id="overviewResultsTitle">${title}</h2><p>${isUrgent ? 'فقط پرونده‌های دارای اولویت فوری در این فهرست هستند.' : 'فهرست خانوارهای فعال سامانه.'}</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></header><div id="overviewFamilyResults" class="overview-family-results"><div class="panel-loading"><div><div class="spinner"></div>در حال دریافت پرونده‌ها…</div></div></div></section></div>`);
    const root = $('#modalRoot'), backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', e => { if (e.target === backdrop)
        closeModal(); });
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    try {
        const d = await api('/api/families/search/advanced?' + query), families = d.families || [], box = $('#overviewFamilyResults');
        box.innerHTML = `<div class="overview-results-count">${fa(d.total || 0)} پرونده</div>${families.length ? families.map(renderOverviewFamily).join('') : '<div class="overview-results-empty"><b>پرونده‌ای برای نمایش نیست</b><span>در حال حاضر موردی با این وضعیت پیدا نشد.</span></div>'}`;
        box.querySelectorAll('[data-overview-family]').forEach(b => b.onclick = () => { const id = b.dataset.overviewFamily; closeModal(); loadDetail(id); });
    }
    catch (e) {
        $('#overviewFamilyResults').innerHTML = `<div class="overview-results-empty"><b>دریافت فهرست ناموفق بود</b><span>${esc(e.message)}</span></div>`;
    }
}

function openActiveFamilyList() { return openOverviewFamilyList('active'); }

function openUrgentFamilyList() { return openOverviewFamilyList('urgent'); }

async function openAttentionItems() {
    AppUI.mountModal(`<div class="modal-backdrop"><section class="modal overview-results-modal attention-results-modal" role="dialog" aria-modal="true" aria-labelledby="attentionResultsTitle"><header class="overview-results-head"><div><span class="eyebrow">پیگیری‌های کاری</span><h2 id="attentionResultsTitle">موارد نیازمند اقدام</h2><p>فقط پیگیری‌های عقب‌افتاده و هشدارهای خوانده‌نشده در این فهرست آمده‌اند.</p></div><button type="button" class="close-btn" data-close aria-label="بستن">×</button></header><div id="attentionResults" class="attention-results"><div class="panel-loading"><div><div class="spinner"></div>در حال جمع‌آوری موارد…</div></div></div></section></div>`);
    const root = $('#modalRoot'), backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', e => { if (e.target === backdrop)
        closeModal(); });
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    try {
        const [overdueResult, alertResult] = await Promise.allSettled([api('/api/follow-ups/overdue'), api('/api/alerts?includeRead=false')]);
        const overdue = overdueResult.status === 'fulfilled' ? overdueResult.value.items || [] : [], alerts = alertResult.status === 'fulfilled' ? alertResult.value.alerts || [] : [];
        const section = (title, count, body) => `<section class="attention-results-section"><header><h3>${title}</h3><span class="count-chip">${fa(count)} مورد</span></header>${body || '<div class="overview-results-empty compact">موردی برای نمایش نیست.</div>'}</section>`;
        const overdueRows = overdue.map(x => `<button type="button" class="overview-family-result" data-attention-family="${esc(x.familyId)}"><span class="overview-family-result-icon is-overdue" aria-hidden="true">◷</span><span class="overview-family-result-copy"><b>${esc(x.headName)} · پرونده ${esc(x.caseNumber)}</b><small>${esc(x.text)} · مسئول: ${esc(x.assigneeName || 'تعیین نشده')}</small></span><span class="overview-family-result-priority">${esc(followupDate(x.nextFollowUpAt))}</span><span aria-hidden="true">←</span></button>`).join('');
        const alertRows = alerts.map(a => `<button type="button" class="overview-family-result" data-attention-alert="${esc(a.key)}" data-attention-alert-family="${esc(a.familyId || '')}"><span class="overview-family-result-icon is-alert" aria-hidden="true">!</span><span class="overview-family-result-copy"><b>${esc(a.title)}</b><small>${esc(a.message)}</small></span><span class="overview-family-result-priority">${esc(alertSeverityNames[a.severity] || a.severity)}</span><span aria-hidden="true">←</span></button>`).join('');
        const box = $('#attentionResults');
        box.innerHTML = section('پیگیری‌های عقب‌افتاده', overdue.length, overdueRows) + section('هشدارهای خوانده‌نشده', alertResult.status === 'fulfilled' ? alertResult.value.unread || alerts.length : alerts.length, alertRows);
        box.querySelectorAll('[data-attention-alert]').forEach(b => b.onclick = async () => { const key = b.dataset.attentionAlert, id = b.dataset.attentionAlertFamily; try {
            await api('/api/alerts/' + encodeURIComponent(key) + '/read', { method: 'POST', body: '{}' });
            refreshAlertBadge();
            closeModal();
            if (id)
                openFamilyRecord(id);
            else
                openAlerts();
        }
        catch (e) {
            toast(e.message);
        } });
        if (overdueResult.status === 'rejected')
            box.insertAdjacentHTML('beforeend', `<p class="overview-results-warning">پیگیری‌های عقب‌افتاده بارگذاری نشد: ${esc(overdueResult.reason.message)}</p>`);
        if (alertResult.status === 'rejected')
            box.insertAdjacentHTML('beforeend', `<p class="overview-results-warning">هشدارها به‌دلیل محدودیت دسترسی نمایش داده نشدند.</p>`);
    }
    catch (e) {
        $('#attentionResults').innerHTML = `<div class="overview-results-empty">دریافت موارد ناموفق بود: ${esc(e.message)}</div>`;
    }
}
