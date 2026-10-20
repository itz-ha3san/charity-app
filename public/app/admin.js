/* Feature: admin. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
async function openTrainingCenter() { try {
    const d = await api('/api/training/modules');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow"></div><h2>راهنما و آموزش سمت شما</h2></div><button class="close-btn" data-close>×</button></div>${actor?.role === 'admin' ? '<div class="modal-actions"><button class="secondary" id="trainingProgressBtn">پیشرفت آموزش</button><button class="secondary" id="handoverBtn">چک‌لیست تحویل</button></div>' : ''}${d.modules.map(m => `<div class="user-row"><div><b>${esc(m.title)}</b><p>${m.topics.map(esc).join(' · ')}</p></div><div class="doc-actions"><button class="secondary" data-training-doc="${m.code}">مطالعه</button><button class="primary" data-training-ack="${m.code}" ${m.acknowledgedAt ? 'disabled' : ''}>${m.acknowledgedAt ? 'تأیید شده' : 'تأیید مطالعه'}</button></div></div>`).join('')}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-training-doc]').forEach(b => b.onclick = () => showTrainingDocument(b.dataset.trainingDoc));
    document.querySelectorAll('[data-training-ack]').forEach(b => b.onclick = async () => { await api('/api/training/modules/' + b.dataset.trainingAck + '/acknowledge', { method: 'POST', body: '{}' }); toast('مطالعه راهنما تأیید شد.'); openTrainingCenter(); });
    $('#trainingProgressBtn') && ($('#trainingProgressBtn').onclick = showTrainingProgress);
    $('#handoverBtn') && ($('#handoverBtn').onclick = showHandoverChecklist);
}
catch (e) {
    toast(e.message);
} }

async function showTrainingDocument(code) { const d = await api('/api/training/modules/' + code + '/document'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><h2>${esc(d.title)}</h2><button class="close-btn" data-close>×</button></div><pre style="white-space:pre-wrap;direction:rtl;font:inherit">${esc(d.content)}</pre><button class="secondary" id="backTraining">بازگشت</button></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#backTraining').onclick = openTrainingCenter; }

async function showTrainingProgress() { const d = await api('/api/training/progress'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><h2>پیشرفت آموزش کاربران</h2><button class="close-btn" data-close>×</button></div>${d.users.map(u => `<div class="user-row"><div><b>${esc(u.displayName)}</b><p>${esc(positionNames[u.position] || u.position)}</p></div><span class="count-chip">${fa(u.acknowledged)} از ${fa(u.required)}</span></div>`).join('')}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

async function showHandoverChecklist() { const d = await api('/api/handover/checklist'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">${d.summary.ready ? 'آماده تحویل' : 'در حال تکمیل'}</div><h2>چک‌لیست تحویل</h2></div><button class="close-btn" data-close>×</button></div>${d.items.map(x => `<div class="user-row"><div><b>${esc(x.title)}</b><p>${esc(x.evidenceNote || 'بدون مدرک')}</p></div><button class="${x.completed ? 'secondary' : 'primary'}" data-handover="${x.code}" data-completed="${x.completed}">${x.completed ? 'بازکردن' : 'تکمیل'}</button></div>`).join('')}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); document.querySelectorAll('[data-handover]').forEach(b => b.onclick = async () => { const complete = b.dataset.completed !== 'true', note = complete ? (prompt('مدرک یا توضیح تأیید:') || 'تأیید مدیر') : ''; await api('/api/handover/checklist/' + b.dataset.handover, { method: 'PUT', body: JSON.stringify({ completed: complete, evidenceNote: note }) }); showHandoverChecklist(); }); }

async function openOpsStatus() { try {
    const d = await api('/api/ops/status');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">Production</div><h2>وضعیت عملیاتی سامانه</h2></div><button class="close-btn" data-close>×</button></div><div class="metric-grid"><div class="metric-card"><span>دیتابیس</span><b>${esc(d.database.status)} · ${fa(d.database.latencyMs)}ms</b></div><div class="metric-card"><span>Uptime</span><b>${fa(d.process.uptimeSeconds)} ثانیه</b></div><div class="metric-card"><span>درخواست‌ها</span><b>${fa(d.http.requests)}</b></div><div class="metric-card"><span>خطاهای 5xx</span><b>${fa(d.http.errors)}</b></div><div class="metric-card"><span>میانگین پاسخ</span><b>${fa(d.http.averageResponseMs)}ms</b></div><div class="metric-card"><span>فضای آزاد</span><b>${fa(Math.round(d.disk.freeBytes / 1073741824))} GB</b></div></div><p class="muted">تازگی Backup باید توسط مانیتور خارجی بررسی شود. Metrics: <code>/api/ops/metrics</code></p></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}
catch (e) {
    toast(e.message);
} }

async function openUatCenter() { try {
    const d = await api('/api/uat/cycles'), active = d.cycles.find(x => x.status === 'active') || d.cycles[0];
    if (!active && actor?.role !== 'admin')
        return toast('چرخه UAT فعالی وجود ندارد.');
    if (!active && actor?.role === 'admin')
        return createUatCycle();
    const scenarios = await api('/api/uat/cycles/' + active.id + '/scenarios');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">${esc(active.targetVersion)}</div><h2>آزمون پذیرش کاربران</h2></div><button class="close-btn" data-close>×</button></div>${actor?.role === 'admin' ? '<div class="modal-actions"><button class="secondary" id="newUatCycle">چرخه جدید</button><button class="secondary" id="uatSummary">خلاصه مدیریتی</button></div>' : ''}<div class="finance-list">${scenarios.scenarios.map(x => `<article class="finance-card"><div class="finance-card-head"><div><h4>${esc(x.code)} · ${esc(x.title)}</h4><div class="finance-meta">${esc(positionNames[x.position] || x.position)} · ${esc(x.priority)}</div></div><span class="status">${esc(x.myStatus || 'آزمایش‌نشده')}</span></div><ol>${(x.steps || []).map(v => `<li>${esc(v)}</li>`).join('')}</ol><p><b>نتیجه مورد انتظار:</b> ${esc(x.expectedResult)}</p><div class="workflow-actions"><button class="primary" data-uat-result="${x.id}" data-status="passed">موفق</button><button class="danger" data-uat-result="${x.id}" data-status="failed">ناموفق</button><button class="secondary" data-uat-feedback="${x.id}">ثبت بازخورد</button></div></article>`).join('') || '<div class="empty-state">سناریویی برای سمت شما تعریف نشده است.</div>'}</div></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-uat-result]').forEach(b => b.onclick = async () => { const notes = prompt('توضیحات نتیجه آزمون:', '') ?? ''; await api('/api/uat/scenarios/' + b.dataset.uatResult + '/result', { method: 'PUT', body: JSON.stringify({ status: b.dataset.status, notes, evidence: {} }) }); toast('نتیجه UAT ثبت شد.'); openUatCenter(); });
    document.querySelectorAll('[data-uat-feedback]').forEach(b => b.onclick = () => submitUatFeedback(active.id, b.dataset.uatFeedback));
    $('#newUatCycle') && ($('#newUatCycle').onclick = createUatCycle);
    $('#uatSummary') && ($('#uatSummary').onclick = () => showUatSummary(active.id));
}
catch (e) {
    toast(e.message);
} }

async function createUatCycle() { const name = prompt('نام چرخه UAT:', 'پذیرش کاربران'), targetVersion = prompt('نسخه هدف:', 'v17.0.0'); if (!name || !targetVersion)
    return; const c = await api('/api/uat/cycles', { method: 'POST', body: JSON.stringify({ name, targetVersion, includeDefaults: true }) }); await api('/api/uat/cycles/' + c.cycleId + '/activate', { method: 'POST', body: '{}' }); openUatCenter(); }

async function submitUatFeedback(cycleId, scenarioId) { const category = prompt('دسته: defect, improvement, ux, training', 'defect'), severity = prompt('شدت: low, normal, high, critical', 'normal'), title = prompt('عنوان بازخورد:'), description = prompt('شرح کامل:'); if (!['defect', 'improvement', 'ux', 'training'].includes(category) || !['low', 'normal', 'high', 'critical'].includes(severity) || !title || !description)
    return; await api('/api/uat/feedback', { method: 'POST', body: JSON.stringify({ cycleId, scenarioId, category, severity, title, description }) }); toast('بازخورد UAT ثبت شد.'); }

async function showUatSummary(id) { const d = await api('/api/uat/cycles/' + id + '/summary'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">آمادگی Release Candidate</div><h2>${d.readiness.ready ? 'آماده انتشار آزمایشی' : 'هنوز آماده نیست'}</h2></div><button class="close-btn" data-close>×</button></div><div class="metric-grid"><div class="metric-card"><span>پوشش همه سمت‌ها</span><b>${d.readiness.allRolesCovered ? 'بله' : 'خیر'}</b></div><div class="metric-card"><span>سناریوهای الزامی</span><b>${d.readiness.requiredPassed ? 'تأیید' : 'ناقص'}</b></div><div class="metric-card"><span>بحرانی باز</span><b>${fa(d.readiness.criticalOpen)}</b></div></div><h3>بازخوردهای اولویت‌بندی‌شده</h3>${d.feedback.map(x => `<div class="audit-card"><b>${esc(x.title)} · ${esc(x.category)} · ${esc(x.severity)}</b><p>${esc(x.description)}</p></div>`).join('') || '<div class="audit-empty">بازخوردی نیست.</div>'}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

function parseMigrationCsv(text) { const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean), parse = line => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && q && line[i + 1] === '"') {
        cur += '"';
        i++;
    }
    else if (c === '"')
        q = !q;
    else if (c === ',' && !q) {
        out.push(cur);
        cur = '';
    }
    else
        cur += c;
} out.push(cur); return out; }, headers = parse(lines.shift() || ''); return lines.map(line => Object.fromEntries(parse(line).map((v, i) => [headers[i], ['housingDeposit', 'housingRent'].includes(headers[i]) ? Number(v || 0) : v]).filter(([k, v]) => k && v !== ''))); }

async function openMigrationCenter() { const batches = await api('/api/data-migration/batches'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow"></div><h2>مدیریت و مهاجرت داده</h2></div><button class="close-btn" data-close>×</button></div><p class="muted">ابتدا قالب استاندارد را دریافت و در Excel تکمیل کنید؛ فایل XLS یا CSV UTF-8 مستقیماً قابل پیش‌نمایش است. ورود نهایی فقط پس از پیش‌نمایش بدون خطا فعال می‌شود.</p><div class="modal-actions"><a class="secondary" href="/api/data-migration/template?format=excel">دریافت قالب Excel</a><button class="primary" id="migrationFileBtn">انتخاب فایل</button><input id="migrationFile" type="file" accept=".xls,.xml,.csv,.json,text/csv,application/json,application/vnd.ms-excel" hidden></div><h3>اجرای اخیر</h3>${batches.batches.map(b => `<div class="user-row"><div><b>${esc(b.sourceName)}</b><p>${esc(b.status)} · ${fa(b.valid)} معتبر · ${fa(b.invalid)} نامعتبر · ${fa(b.imported)} واردشده</p></div><button class="secondary" data-migration-report="${b.id}">گزارش تطبیق</button></div>`).join('') || '<div class="audit-empty">هنوز مهاجرتی ثبت نشده است.</div>'}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#migrationFileBtn').onclick = () => $('#migrationFile').click(); $('#migrationFile').onchange = previewMigrationFile; document.querySelectorAll('[data-migration-report]').forEach(b => b.onclick = () => showMigrationReport(b.dataset.migrationReport)); }

function parseMigrationExcelXml(text) { const xml = new DOMParser().parseFromString(text, 'application/xml'), table = [...xml.getElementsByTagNameNS('*', 'Row')].map(r => [...r.getElementsByTagNameNS('*', 'Data')].map(x => x.textContent || '')), headers = table.shift() || []; return table.map(values => Object.fromEntries(values.map((v, i) => [headers[i], ['housingDeposit', 'housingRent'].includes(headers[i]) ? Number(v || 0) : v]).filter(([k, v]) => k && v !== ''))); }

async function previewMigrationFile(e) { const file = e.target.files[0]; if (!file)
    return; try {
    const text = await file.text(), lower = file.name.toLowerCase(), isJson = lower.endsWith('.json'), isExcel = lower.endsWith('.xls') || lower.endsWith('.xml'), rows = isJson ? (JSON.parse(text).rows || JSON.parse(text)) : isExcel ? parseMigrationExcelXml(text) : parseMigrationCsv(text), d = await api('/api/data-migration/preview', { method: 'POST', body: JSON.stringify({ sourceName: file.name, sourceType: isJson ? 'json' : isExcel ? 'excel' : 'csv', rows }) });
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">پیش‌نمایش </div><h2>${esc(file.name)}</h2></div><button class="close-btn" data-close>×</button></div><div class="metric-grid"><div class="metric-card"><span>کل</span><b>${fa(d.total)}</b></div><div class="metric-card"><span>معتبر</span><b>${fa(d.valid)}</b></div><div class="metric-card"><span>نامعتبر</span><b>${fa(d.invalid)}</b></div></div>${d.rows.filter(x => x.errors.length).map(x => `<div class="audit-card"><b>ردیف ${fa(x.rowNumber)} · ${esc(x.entityType)}</b><p>${x.errors.map(esc).join('، ')}</p></div>`).join('') || '<div class="message success">تمام ردیف‌ها معتبر هستند.</div>'}<div class="modal-actions"><button class="primary" id="executeMigration" ${d.canExecute ? '' : 'disabled'}>اجرای ورود نهایی</button><button class="secondary" id="retryMigration">اصلاح و اجرای مجدد</button></div></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    $('#retryMigration').onclick = openMigrationCenter;
    $('#executeMigration').onclick = async () => { const r = await api('/api/data-migration/batches/' + d.batchId + '/execute', { method: 'POST', body: '{}' }); const creds = r.temporaryCredentials || []; toast(fa(r.imported) + ' ردیف وارد شد.'); if (creds.length)
        alert('رمزهای موقت را اکنون در محل امن ذخیره کنید:\n' + creds.map(x => x.username + ' : ' + x.temporaryPassword).join('\n')); openMigrationCenter(); loadFamilies(); };
}
catch (err) {
    toast(err.message);
} }

async function showMigrationReport(id) { const d = await api('/api/data-migration/batches/' + id + '/report'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><h2>گزارش تطبیق ${esc(d.batch.sourceName)}</h2><button class="close-btn" data-close>×</button></div><div class="metric-grid"><div class="metric-card"><span>منبع</span><b>${fa(d.batch.total)}</b></div><div class="metric-card"><span>واردشده</span><b>${fa(d.batch.imported)}</b></div><div class="metric-card"><span>نامعتبر</span><b>${fa(d.batch.invalid)}</b></div></div>${d.reconciliation.map(x => `<div class="audit-card"><b>${esc(x.entityType)} · ${esc(x.status)}</b><p>${fa(x.count)} ردیف</p></div>`).join('')}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

async function openSecurityCenter() { try {
    const [p, a, e] = await Promise.all([api('/api/security/retention-policy'), api('/api/security/sensitive-access?limit=30'), api('/api/security/events?limit=30')]);
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow"></div><h2>امنیت و حریم خصوصی</h2></div><button class="close-btn" data-close>×</button></div><div class="metric-grid"><div class="metric-card"><span>نگهداری نشست</span><b>${fa(p.policy.sessionDays)} روز</b></div><div class="metric-card"><span>نگهداری رویداد امنیتی</span><b>${fa(p.policy.securityEventDays)} روز</b></div><div class="metric-card"><span>پشتیبان رمزگذاری‌شده</span><b>${p.policy.backupEncryptionRequired ? 'الزامی' : 'اختیاری'}</b></div></div><h3>دسترسی‌های حساس اخیر</h3>${a.events.map(x => `<div class="audit-card"><b>${esc(x.actorName || 'سیستم')} · ${esc(x.resourceType)}</b><p>${esc(x.reason)} · پرونده ${esc(x.caseNumber || '—')}</p></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}<h3>رویدادهای امنیتی اخیر</h3>${e.events.map(x => `<div class="audit-card"><b>${esc(x.eventType)} · ${esc(x.severity)}</b><p>${esc(x.username || x.actorName || 'سیستم')}</p></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}
catch (err) {
    toast(err.message);
} }

async function openUserRegistry() { try {
    const data = await api('/api/users/registry');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">کنترل دسترسی</div><h2>اطلاعات کاربران</h2></div><button class="close-btn" data-close>×</button></div><div class="registry-banner">رمزهای عبور فقط به‌صورت هش یک‌طرفه ذخیره می‌شوند و قابل نمایش یا بازیابی نیستند. برای تغییر رمز از بازنشانی رمز عبور استفاده کنید.</div><div class="registry-table-wrap"><table class="registry-table"><thead><tr><th>#</th><th>کاربر</th><th>سمت سازمانی</th><th>وضعیت</th><th>هش</th><th>نشست‌ها</th><th>ورود</th><th>تاریخ ایجاد</th></tr></thead><tbody>${data.users.map((u, i) => registryRow(u, i)).join('') || '<tr><td colspan="8">کاربری ثبت نشده است.</td></tr>'}</tbody></table></div><div class="modal-actions"><button class="secondary" id="backToUsers">بازگشت به مدیریت کاربران</button></div></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    $('#backToUsers').onclick = openUsers;
}
catch (err) {
    toast(err.message);
} }

function registryRow(u, i) { const lastLogin = u.lastLoginAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(u.lastLoginAt)) : '—', created = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(u.createdAt)), lock = u.lockedUntil && new Date(u.lockedUntil) > new Date() ? '<span class="registry-tag danger">قفل تا ' + new Intl.DateTimeFormat('fa-IR', { timeStyle: 'short' }).format(new Date(u.lockedUntil)) + '</span>' : ''; return `<tr><td>${i + 1}</td><td><b>${esc(u.displayName)}</b><small dir="ltr">${esc(u.username)}</small></td><td>${esc(positionNames[u.position] || 'سمت تعریف نشده')}</td><td>${u.active ? '<span class="registry-tag ok">فعال</span>' : '<span class="registry-tag">غیرفعال</span>'}${u.mustChangePassword ? '<span class="registry-tag warn">تغییر اجباری رمز</span>' : ''}${u.failedLoginCount > 0 ? '<span class="registry-tag">تلاش ناموفق: ' + fa(u.failedLoginCount) + '</span>' : ''}${lock}</td><td><code dir="ltr">${esc(u.algo || '?')}$…</code><small>طول: ${fa(u.hashLength)}</small></td><td>${fa(u.activeSessions)}</td><td><small>آخرین ورود: ${lastLogin}</small><small>تغییر رمز: ${u.passwordChangedAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(u.passwordChangedAt)) : '—'}</small></td><td>${created}</td></tr>`; }

function confirmDanger(title, description, confirmLabel) { return new Promise(resolve => { const root = document.createElement('div'); root.className = 'modal-backdrop'; root.innerHTML = '<div class="modal"><div class="modal-head"><h2>' + esc(title) + '</h2></div><p>' + description + '</p><div class="modal-actions"><button class="secondary" data-cancel>انصراف</button><button class="danger" data-confirm>' + esc(confirmLabel) + '</button></div></div>'; document.body.append(root); const done = v => { root.remove(); resolve(v); }; root.querySelector('[data-cancel]').onclick = () => done(false); root.querySelector('[data-confirm]').onclick = () => done(true); root.onclick = e => { if (e.target === root)
    done(false); }; }); }

async function deleteUser(id, username) { const ok = await confirmDanger('حذف کامل کاربر', 'کاربر «' + esc(username) + '» برای همیشه حذف می‌شود. ارجاع‌های غیرقابل‌خالی‌شدن (اقدامات، ارجاع‌ها، سرپرست‌ها، گزارش‌های نظارتی) به حساب شما منتقل می‌شوند و سایر ارجاع‌ها پاک می‌شوند. این کار قابل بازگشت نیست.', 'حذف قطعی'); if (!ok)
    return; try {
    const r = await api('/api/users/' + id, { method: 'DELETE' }), moved = (r.details?.counts || []).filter(x => x.action === 'reassigned').reduce((n, x) => n + x.rows, 0), cleared = (r.details?.counts || []).filter(x => x.action === 'cleared').reduce((n, x) => n + x.rows, 0), removed = (r.details?.counts || []).filter(x => x.action === 'deleted').reduce((n, x) => n + x.rows, 0);
    toast('کاربر حذف شد. منتقل‌شده: ' + fa(moved) + ' · پاک‌شده: ' + fa(cleared) + ' · حذف‌شده: ' + fa(removed));
    openUsers();
}
catch (err) {
    toast(err.message);
} }

async function openUsers() { const data = await api('/api/users'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">کنترل دسترسی</div><h2>مدیریت کاربران</h2></div><button class="close-btn" data-close>×</button></div><button class="primary" id="createUserBtn">کاربر جدید</button>${actor?.isSuperAdmin ? '<button class="secondary" id="registryBtn">مشاهده اطلاعات کامل کاربران</button>' : ''}<div>${data.users.map(u => `<div class="user-row"><div><b>${esc(u.displayName)}</b><p>${esc(u.username)} · ${esc(positionNames[u.position] || 'سمت تعریف نشده')} · ${u.active ? 'فعال' : 'غیرفعال'} · ${fa(u.activeSessions)} نشست</p></div><div class="doc-actions"><button class="secondary" data-toggle-user="${u.id}" data-active="${u.active}">${u.active ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button><button class="secondary" data-position-user="${u.id}" data-position="${esc(u.position)}">تغییر سمت</button>${actor?.isSuperAdmin ? `<button class="secondary" data-audit-user="${u.id}">Audit</button>` : ''}${u.active ? `<button class="secondary danger" data-delete-user="${u.id}" data-username="${esc(u.username)}">حذف کاربر</button>` : ''}<button class="secondary" data-reset-user="${u.id}">Reset رمز</button></div></div>`).join('')}</div><button class="secondary" id="sessionsBtn">مشاهده نشست‌های فعال</button></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#createUserBtn').onclick = openCreateUser; document.querySelectorAll('[data-toggle-user]').forEach(b => b.onclick = async () => { await api('/api/users/' + b.dataset.toggleUser, { method: 'PATCH', body: JSON.stringify({ active: b.dataset.active !== 'true' }) }); openUsers(); }); document.querySelectorAll('[data-position-user]').forEach(b => b.onclick = () => openPositionDialog(b.dataset.positionUser, b.dataset.position, b.closest('.user-row')?.querySelector('b')?.textContent || 'کاربر')); document.querySelectorAll('[data-audit-user]').forEach(b => b.onclick = () => openUserAudit(b.dataset.auditUser)); document.querySelectorAll('[data-reset-user]').forEach(b => b.onclick = () => openPasswordDialog(b.dataset.resetUser, b.closest('.user-row')?.querySelector('b')?.textContent || 'کاربر')); $('#sessionsBtn').onclick = openSessions; if ($('#registryBtn'))
    $('#registryBtn').onclick = openUserRegistry; document.querySelectorAll('[data-delete-user]').forEach(b => b.onclick = () => deleteUser(b.dataset.deleteUser, b.dataset.username)); }

async function openUserAudit(id) { const data = await api('/api/users/' + id + '/audit'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><h2>Audit کاربر ${esc(data.user.display_name)}</h2><button class="close-btn" data-close>×</button></div>${data.events.map(e => `<div class="audit-card"><b>${esc(e.action)}</b><p>${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.createdAt))} · ${esc(e.actorName || 'سیستم')}</p></div>`).join('') || '<div class="audit-empty">رویدادی ثبت نشده است.</div>'}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

function openCreateUser() { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>کاربر جدید</h2><button class="close-btn" data-close>×</button></div><form id="userForm"><div class="form-grid"><div class="form-field"><label>نام نمایشی</label><input name="displayName" required></div><div class="form-field"><label>نام کاربری</label><input name="username" required></div><div class="form-field"><label>رمز عبور</label><input name="password" type="password" minlength="12" required></div><div class="form-field"><label>سمت سازمانی</label><select name="position" required><option value="liaison">رابط</option><option value="education_deputy">معاون آموزشی</option><option value="supervision_deputy">معاون سرپرستی</option><option value="health_deputy">معاون بهداشت</option><option value="finance_deputy">معاون مالی</option><option value="ceo">معاون کل</option></select></div></div><div id="userError" class="message error"></div><div class="modal-actions"><button class="primary">ایجاد کاربر</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#userForm').onsubmit = async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); try {
    await api('/api/users', { method: 'POST', body: JSON.stringify(data) });
    openUsers();
}
catch (err) {
    $('#userError').textContent = err.message;
} }; }

async function openSessions() { const data = await api('/api/sessions'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>نشست‌های فعال</h2><button class="close-btn" data-close>×</button></div>${data.sessions.map(s => `<div class="user-row"><div><b>${esc(s.displayName)}</b><p>${esc(s.username)} · انقضا ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s.expiresAt))}</p></div><button class="danger" data-revoke="${s.id}">بستن نشست</button></div>`).join('') || '<div class="audit-empty">نشست فعالی نیست.</div>'}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); document.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => { await api('/api/sessions/' + b.dataset.revoke, { method: 'DELETE', body: '{}' }); openSessions(); }); }

function openPublicSupportForm() { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>ثبت درخواست حمایت</h2><button class="close-btn" data-close>×</button></div><form id="supportPublicForm"><div class="form-grid"><div class="form-field"><label>نام متقاضی</label><input name="applicantName" required minlength="2"></div><div class="form-field"><label>تلفن</label><input name="phone" required minlength="10"></div><div class="form-field"><label>کد ملی اختیاری</label><input name="nationalId" pattern="[0-9]{10}" maxlength="10"></div><div class="form-field full"><label>شرح نیاز</label><textarea name="summary" required minlength="10"></textarea></div></div><div class="message error"></div><button class="primary">ثبت امن</button></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#supportPublicForm').onsubmit = async (e) => { e.preventDefault(); const f = e.currentTarget, x = Object.fromEntries(new FormData(f)); x.nationalId = x.nationalId || null; try {
    const r = await api('/public/support-requests', { method: 'POST', body: JSON.stringify(x) });
    f.innerHTML = `<h3>درخواست ثبت شد</h3><p>کد رهگیری را نگه دارید:</p><b style="font-size:22px;direction:ltr">${esc(r.trackingCode)}</b>`;
}
catch (err) {
    message(f, err.message);
} }; }

async function trackPublicSupport() { const c = prompt('کد رهگیری:'); if (!c)
    return; try {
    const r = await api('/public/support-requests/' + encodeURIComponent(c.trim()) + '/status');
    alert('وضعیت: ' + r.status);
}
catch (e) {
    toast(e.status === 404 ? 'کد پیدا نشد.' : e.message);
} }

async function openFutureCenter() { try {
    const [d, donors, donations, inventory, requests, map] = await Promise.all([api('/api/future/dashboard'), api('/api/donors'), api('/api/donations'), api('/api/inventory'), api('/api/support-requests'), api('/api/families/map')]);
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow"></div><h2>حامیان، کمک‌ها و انبار</h2></div><button class="close-btn" data-close>×</button></div><div class="metric-grid">${[['حامی فعال', d.donors.active], ['کمک نقدی', money(d.cashDonations)], ['کالای انبار', d.inventory.items], ['کم‌موجودی', d.inventory.low], ['درخواست جدید', d.supportRequests.new], ['پیام صف', d.notifications.queued]].map(x => `<div class="metric-card"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('')}</div><div class="modal-actions"><button id="newDonor" class="primary">حامی جدید</button><button id="newDonation" class="secondary">کمک جدید</button><button id="newItem" class="secondary">کالای جدید</button><button id="stockTx" class="secondary">گردش انبار</button><button id="queueMsg" class="secondary">صف پیام</button><button id="setGeo" class="secondary">مختصات</button></div><h3>حامیان ثبت‌شده</h3>${donors.donors.map(x => `<div class="user-row"><div><b>${esc(x.name)}</b><p>${esc(x.phone || 'تلفن ثبت نشده')} · ${esc(x.email || '')}</p></div></div>`).join('') || '<p class="muted">حامی ثبت نشده است.</p>'}<h3>کمک‌ها</h3>${donations.donations.map(x => `<div class="user-row"><div><b>${esc(x.donorName)} · ${x.donationType === 'cash' ? money(x.amount) : 'غیرنقدی'}</b><p>${esc(x.description)} · ${esc(x.status)}</p></div><div class="doc-actions">${x.status === 'pledged' ? `<button class="primary" data-receive="${x.id}">دریافت</button>` : ''}${['received', 'allocated'].includes(x.status) ? `<button class="secondary" data-allocate="${x.id}" data-kind="${x.donationType}">تخصیص</button>` : ''}</div></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}<h3>انبار</h3>${inventory.items.map(x => `<div class="user-row"><b>${esc(x.name)}</b><span>${fa(x.stock)} ${esc(x.unit)}</span></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}<h3>درخواست عمومی</h3>${requests.requests.map(x => `<div class="user-row"><div><b>${esc(x.applicantName)} · ${esc(x.trackingCode)}</b><p>${esc(x.summary)} · ${esc(x.status)}</p></div><button class="secondary" data-review-support="${x.id}">بررسی</button></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}<h3>موقعیت‌های ثبت‌شده</h3>${map.families.map(x => `<div class="user-row"><b>${esc(x.caseNumber)} · ${esc(x.headName)}</b><span>${esc(x.latitude)}, ${esc(x.longitude)}</span></div>`).join('') || '<div class="audit-empty">موردی نیست.</div>'}<p class="muted">SMS/Email فقط در Outbox صف می‌شود و ارسال واقعی به Provider نیاز دارد. داده حساس آفلاین Cache نمی‌شود.</p></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    $('#newDonor').onclick = openDonorForm;
    $('#newDonation').onclick = async () => { if (!donors.donors.length)
        return toast('ابتدا حامی ثبت کنید.'); const amount = prompt('مبلغ کمک نقدی:'); if (!amount)
        return; await api('/api/donations', { method: 'POST', body: JSON.stringify({ donorId: donors.donors[0].id, donationType: 'cash', amount: Number(amount), description: prompt('شرح:') || '' }) }); openFutureCenter(); };
    $('#newItem').onclick = async () => { const name = prompt('نام کالا:'), unit = name && prompt('واحد:', 'عدد'); if (!name || !unit)
        return; await api('/api/inventory/items', { method: 'POST', body: JSON.stringify({ name, unit, minimumStock: 0 }) }); openFutureCenter(); };
    $('#stockTx').onclick = async () => { if (!inventory.items.length)
        return toast('ابتدا کالا ثبت کنید.'); const quantity = prompt('مقدار ورود:'); if (!quantity)
        return; await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ itemId: inventory.items[0].id, type: 'receipt', quantity: Number(quantity), note: 'ثبت از رابط ' }) }); openFutureCenter(); };
    $('#queueMsg').onclick = async () => { const recipient = prompt('گیرنده:'), message = recipient && prompt('متن پیام:'); if (!recipient || !message)
        return; await api('/api/notifications/outbox', { method: 'POST', body: JSON.stringify({ channel: 'sms', recipient, templateKey: 'manual_notice', payload: { message } }) }); openFutureCenter(); };
    $('#setGeo').onclick = async () => { if (!selectedId)
        return toast('ابتدا یک خانواده انتخاب کنید.'); const latitude = prompt('عرض جغرافیایی:'), longitude = latitude && prompt('طول جغرافیایی:'); if (!latitude || !longitude)
        return; await api('/api/families/' + selectedId + '/geography', { method: 'PATCH', body: JSON.stringify({ latitude: Number(latitude), longitude: Number(longitude) }) }); openFutureCenter(); };
    document.querySelectorAll('[data-receive]').forEach(b => b.onclick = async () => { await api('/api/donations/' + b.dataset.receive + '/receive', { method: 'POST', body: '{}' }); openFutureCenter(); });
    document.querySelectorAll('[data-allocate]').forEach(b => b.onclick = async () => { if (!selectedId)
        return toast('خانواده مقصد را انتخاب کنید.'); const n = prompt(b.dataset.kind === 'cash' ? 'مبلغ تخصیص:' : 'تعداد:'); if (!n)
        return; await api('/api/donations/' + b.dataset.allocate + '/allocate', { method: 'POST', body: JSON.stringify({ familyId: selectedId, ...(b.dataset.kind === 'cash' ? { amount: Number(n) } : { quantity: Number(n) }), note: '' }) }); openFutureCenter(); });
    document.querySelectorAll('[data-review-support]').forEach(b => b.onclick = async () => { const status = prompt('وضعیت: reviewing, accepted, rejected, closed', 'reviewing'); if (!['reviewing', 'accepted', 'rejected', 'closed'].includes(status))
        return; await api('/api/support-requests/' + b.dataset.reviewSupport, { method: 'PATCH', body: JSON.stringify({ status, decisionNote: prompt('یادداشت:') || '' }) }); openFutureCenter(); });
}
catch (e) {
    toast(e.message);
} }
