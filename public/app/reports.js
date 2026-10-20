/* Feature: reports. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const completenessLabels = { caseNumber: 'شماره پرونده', familySurname: 'نام خانوادگی', headName: 'نام فرد اصلی خانوار', headNationalId: 'کد ملی فرد اصلی خانوار', headPhone: 'شماره تماس فرد اصلی خانوار', address: 'نشانی', headJob: 'شغل فرد اصلی خانوار', headBirthDate: 'تاریخ تولد فرد اصلی خانوار', headEducation: 'تحصیلات فرد اصلی خانوار', familyPhone: 'تلفن خانواده', housingCost: 'ودیعه یا اجاره مسکن', members: 'اعضای خانوار', notes: 'توضیحات پرونده', familyNotes: 'توضیحات پرونده', headCardNumber: 'شماره کارت واریز ماهانه', insurance: 'اطلاعات بیمه', medical: 'وضعیت درمانی', incomeDescription: 'شرح درآمد', debt: 'بدهی و علت آن', transportationCost: 'هزینه رفت‌وآمد', utilityCost: 'هزینه قبوض', monthlyInstallments: 'اقساط ماهانه', monthlyAid: 'کمک ماهانه', sponsor: 'حامی', nextFollowUp: 'پیگیری بعدی', supervisor: 'سرپرست ارتباط خانواده', supervisionPlan: 'برنامه پیگیری' };

function renderFamilyHeaderTags(tags = []) { const box = $('#familyHeaderTags'); if (!box)
    return; const items = Array.isArray(tags) ? tags : []; box.innerHTML = items.map(t => `<span class="family-tag-chip family-header-tag-chip" data-color="${esc(t.color || 'blue')}">${esc(t.name)}</span>`).join(''); box.hidden = items.length === 0; }

async function loadComprehensiveFamily(f) {
    const box = $('#comprehensiveContent');
    if (!box)
        return;
    try {
        const d = await api('/api/families/' + f.id + '/comprehensive');
        renderFamilyHeaderTags(d.tags || []);
        const canTag = actor?.role === 'admin' || ['ceo', 'supervision_deputy', 'liaison'].includes(actor?.position);
        const canEditFields = actor?.role === 'admin' || actor?.position === 'liaison';
        const requiredMissing = new Set(d.completeness.requiredMissingFields || []);
        const missing = d.completeness.missingFields || [];
        const missingButton = key => canEditFields ? `<button type="button" class="completeness-action ${requiredMissing.has(key) ? 'is-required' : ''}" data-missing-field="${esc(key)}"><span>${esc(completenessLabels[key] || 'سایر اطلاعات')}</span><small>ویرایش</small></button>` : `<span class="completeness-action is-readonly"><span>${esc(completenessLabels[key] || 'سایر اطلاعات')}</span></span>`;
        const renderTags = () => d.tags?.length ? d.tags.map(t => `<span class="family-tag-chip" data-color="${esc(t.color || 'blue')}"><span>${esc(t.name)}</span>${canTag ? `<button type="button" aria-label="حذف برچسب ${esc(t.name)}" data-remove-family-tag="${esc(t.id)}">×</button>` : ''}</span>`).join('') : '<span class="comprehensive-empty-note">برچسبی برای این پرونده ثبت نشده است.</span>';
        const percent = Number(d.completeness?.percent ?? 0);
        const timeline = d.timeline || [];
        box.innerHTML = `<div class="profile-integrated-content-inner">
      <div class="profile-integrated-meta" aria-label="وضعیت پیگیری خانواده">
        <div><span class="profile-integrated-icon" aria-hidden="true">◷</span><span><small>آخرین تماس</small><b>${esc(d.followUp?.lastContactAt ? followupDate(d.followUp.lastContactAt, true) : 'ثبت نشده')}</b></span></div>
        <div><span class="profile-integrated-icon" aria-hidden="true">↗</span><span><small>پیگیری بعدی</small><b>${esc(d.followUp?.nextFollowUpAt ? followupDate(d.followUp.nextFollowUpAt, true) : 'تعریف نشده')}</b></span></div>
        <a class="secondary profile-integrated-print" target="_blank" rel="noopener" href="/api/families/${encodeURIComponent(f.id)}/print">چاپ خلاصه</a>
      </div>
      <section class="profile-integrated-section profile-integrated-tags"><header class="profile-integrated-subhead"><div><h4>برچسب‌های پرونده</h4><p>برای دسته‌بندی و پیدا کردن سریع‌تر خانواده</p></div>${canTag ? '<button class="secondary" id="assignFamilyTagBtn" type="button">مدیریت برچسب‌ها</button>' : ''}</header><div class="family-tag-list">${renderTags()}</div></section>
      <section class="profile-integrated-section profile-integrated-missing"><header class="profile-integrated-subhead"><div><h4>فیلدهای خالی و نیازمند تکمیل</h4><p>درصد تکمیل از مجموع همین موارد اجباری و اختیاری محاسبه می‌شود؛ ${canEditFields ? 'برای ویرایش مستقیم روی هر مورد بزنید.' : 'فهرست همهٔ موارد خالی پرونده.'}</p></div><span class="comprehensive-count">${fa(missing.length)} مورد</span></header>${missing.length ? `<div class="completeness-groups">${(d.completeness.requiredMissingFields || []).length ? `<div class="completeness-group"><b>فیلدهای اجباری</b><div class="completeness-actions">${d.completeness.requiredMissingFields.map(missingButton).join('')}</div></div>` : ''}${(d.completeness.optionalMissingFields || []).length ? `<div class="completeness-group"><b>فیلدهای اختیاری</b><div class="completeness-actions">${d.completeness.optionalMissingFields.map(missingButton).join('')}</div></div>` : ''}</div>` : '<div class="comprehensive-all-complete"><span aria-hidden="true">✓</span><div><b>فیلد خالی‌ای باقی نمانده است</b></div></div>'}</section>
      <section class="profile-integrated-section profile-integrated-timeline"><header class="profile-integrated-subhead"><div><h4>آخرین فعالیت‌های پرونده</h4><p>گزارش‌ها، یادداشت‌ها و تغییرات اخیر</p></div><span class="comprehensive-count">${fa(timeline.length)} رویداد</span></header><div class="audit-timeline">${timeline.slice(0, 30).map(e => `<article class="audit-event"><div class="audit-dot">•</div><div class="audit-card"><b>${esc(auditLabels[e.type] || 'تغییر در پرونده')}</b><div class="audit-meta">${esc(e.actor || 'سامانه')} · ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(e.at))}</div>${e.details?.note ? `<p>${esc(e.details.note)}</p>` : ''}</div></article>`).join('') || '<div class="audit-empty">هنوز فعالیتی ثبت نشده است.</div>'}</div></section>
    </div>`;
        const completedCount = $('#familyDetail [data-profile-complete-count]');
        const missingCount = $('#familyDetail [data-profile-missing-count]');
        if(completedCount)completedCount.textContent=fa(d.completeness.completeFields);
        if(missingCount)missingCount.textContent=fa(missing.length);
        const completionValue = $('#profileCompletenessValue');
        if (completionValue)
            completionValue.textContent = fa(percent) + '٪';
        window.UXSystem?.familyProgress?.(f, d.completeness);
        $('#assignFamilyTagBtn') && ($('#assignFamilyTagBtn').onclick = () => assignFamilyTag(f, d.tags || []));
        box.querySelectorAll('[data-missing-field]').forEach(b => b.onclick = () => window.dispatchEvent(new CustomEvent('familymissingfield', { detail: { family: f, fieldKey: b.dataset.missingField } })));
        box.querySelectorAll('[data-remove-family-tag]').forEach(b => b.onclick = async () => { try {
            await api('/api/families/' + f.id + '/tags/' + b.dataset.removeFamilyTag, { method: 'DELETE' });
            await loadComprehensiveFamily(f);
        }
        catch (e) {
            toast(e.message);
        } });
    }
    catch (e) {
        box.innerHTML = `<p class="profile-integrated-error">نمایش وضعیت و سابقهٔ پرونده ممکن نشد.</p>`;
    }
}

async function assignFamilyTag(f, currentTags = []) {
    try {
        const d = await api('/api/family-tags');
        const active = d.tags.filter(x => x.active), assigned = new Set(currentTags.map(x => x.id));
        const available = active.filter(x => !assigned.has(x.id));
        const canCreate = actor?.role === 'admin' || ['ceo', 'supervision_deputy', 'liaison'].includes(actor?.position);
        AppUI.mountModal(`<div class="modal-backdrop"><div class="modal tag-manager-modal" role="dialog" aria-modal="true" aria-labelledby="familyTagTitle"><div class="modal-head"><div><div class="eyebrow">دسته‌بندی پرونده</div><h2 id="familyTagTitle">مدیریت برچسب‌های خانواده</h2></div><button class="close-btn" type="button" data-close aria-label="بستن">×</button></div><p class="tag-modal-description">برچسب‌ها کمک می‌کنند پرونده را دسته‌بندی کنید و بعداً راحت‌تر پیدایش کنید.</p><section class="tag-modal-section"><h3>برچسب‌های فعلی</h3><div class="family-tag-list tag-modal-current">${currentTags.length ? currentTags.map(t => `<span class="family-tag-chip" data-color="${esc(t.color || 'blue')}"><span>${esc(t.name)}</span><button type="button" aria-label="حذف برچسب ${esc(t.name)}" data-modal-remove-tag="${esc(t.id)}">×</button></span>`).join('') : '<span class="comprehensive-empty-note">هنوز برچسبی ثبت نشده است.</span>'}</div></section><section class="tag-modal-section"><h3>افزودن برچسب</h3>${available.length ? `<div class="tag-add-row"><select id="familyTagSelect" aria-label="انتخاب برچسب">${available.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select><button id="addFamilyTagBtn" class="primary" type="button">افزودن به پرونده</button></div>` : `<p class="comprehensive-empty-note">${active.length ? 'همه برچسب‌های فعال به این پرونده اضافه شده‌اند.' : 'برچسب فعالی برای افزودن وجود ندارد.'}</p>`}</section>${canCreate ? `<details class="tag-create-details"><summary>ساخت برچسب جدید</summary><form id="createFamilyTagForm" class="tag-create-form"><label>نام برچسب<input name="name" required minlength="2" maxlength="80" placeholder="مثلاً نیاز درمانی"></label><label>رنگ<select name="color"><option value="blue">آبی</option><option value="green">سبز</option><option value="orange">نارنجی</option><option value="red">قرمز</option><option value="purple">بنفش</option><option value="yellow">زرد</option><option value="pink">صورتی</option><option value="gray">خاکستری</option></select></label><button class="secondary" type="submit">ساخت و افزودن</button></form></details>` : ''}<div id="familyTagError" class="message error" aria-live="polite"></div></div></div>`);
        document.querySelectorAll('#modalRoot [data-close]').forEach(b => b.onclick = closeModal);
        $('#addFamilyTagBtn') && ($('#addFamilyTagBtn').onclick = async () => { const tagId = $('#familyTagSelect')?.value; if (!tagId)
            return; try {
            await api('/api/families/' + f.id + '/tags', { method: 'POST', body: JSON.stringify({ tagId }) });
            closeModal();
            await loadComprehensiveFamily(f);
        }
        catch (e) {
            $('#familyTagError').textContent = e.message;
        } });
        document.querySelectorAll('#modalRoot [data-modal-remove-tag]').forEach(b => b.onclick = async () => { try {
            await api('/api/families/' + f.id + '/tags/' + b.dataset.modalRemoveTag, { method: 'DELETE' });
            closeModal();
            await loadComprehensiveFamily(f);
        }
        catch (e) {
            $('#familyTagError').textContent = e.message;
        } });
        const createForm = $('#createFamilyTagForm');
        if (createForm)
            createForm.onsubmit = async (e) => { e.preventDefault(); const form = e.currentTarget, body = Object.fromEntries(new FormData(form)); try {
                const created = await api('/api/family-tags', { method: 'POST', body: JSON.stringify(body) });
                await api('/api/families/' + f.id + '/tags', { method: 'POST', body: JSON.stringify({ tagId: created.tagId }) });
                closeModal();
                await loadComprehensiveFamily(f);
            }
            catch (err) {
                $('#familyTagError').textContent = err.message;
            } };
    }
    catch (e) {
        toast(e.message);
    }
}

async function openAdvancedFamilySearch(filters = {}) {
    try {
        const [tagData, assigneeData] = await Promise.all([api('/api/family-tags'), api('/api/assignees')]), tags = tagData.tags || [], liaisons = (assigneeData.users || []).filter(x => x.position === 'liaison'), modalRoot = $('#modalRoot'), status = filters.status || 'active';
        const option = (name, value, label, selected = false) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;
        const selectField = (name, label, options) => `<label class="advanced-search-field"><span>${label}</span><select name="${name}">${options}</select></label>`;
        const statusOptions = [['active', 'پرونده‌های فعال'], ['archived', 'آرشیوشده'], ['all', 'همه']].map(([v, l]) => option('status', v, l, status === v)).join('');
        const priorityOptions = [['', 'همه اولویت‌ها'], ['متوسط', 'متوسط'], ['بالا', 'بالا'], ['فوری', 'فوری'], ['بحرانی', 'بحرانی']].map(([v, l]) => option('priority', v, l, (filters.priority ?? '') === v)).join('');
        const liaisonOptions = [option('liaisonId', '', 'همه رابط‌ها', !filters.liaisonId), ...liaisons.map(x => option('liaisonId', x.id, x.name, filters.liaisonId === x.id))].join('');
        const tagOptions = [option('tagId', '', 'همه برچسب‌ها', !filters.tagId), ...tags.filter(x => x.active).map(x => option('tagId', x.id, x.name, filters.tagId === x.id))].join('');
        const incompleteOptions = [['', 'همه پرونده‌ها'], ['true', 'فقط اطلاعات ناقص'], ['false', 'فقط پرونده‌های کامل']].map(([v, l]) => option('incomplete', v, l, (filters.incomplete ?? '') === v)).join('');
        const domainOptions = [['', 'همه حوزه‌ها'], ['health', 'درمان'], ['education', 'آموزش']].map(([v, l]) => option('specialistDomain', v, l, (filters.specialistDomain ?? '') === v)).join('');
        modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal advanced-family-modal" role="dialog" aria-modal="true" aria-labelledby="advancedSearchTitle"><header class="advanced-search-head"><div class="advanced-search-heading"><span class="advanced-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5M8 10.8h5.5"/></svg></span><div><small>ابزارهای پرونده · </small><h2 id="advancedSearchTitle">جست‌وجوی پیشرفتهٔ خانواده‌ها</h2><p>ترکیبی از مشخصات، وضعیت تکمیل و پیگیری‌ها را برای یافتن پرونده به‌کار ببرید.</p></div></div><button class="close-btn" type="button" data-close aria-label="بستن جستجو">×</button></header><form id="advancedFamilyForm" class="advanced-search-form"><label class="advanced-search-query"><span>عبارت جست‌وجو</span><div class="advanced-search-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg><input name="q" type="search" value="${esc(filters.q || '')}" placeholder="نام فرد، نام خانوادگی، شماره پرونده یا تلفن…" autocomplete="off"></div></label><div class="advanced-search-section-title"><b>فیلترهای پرونده</b><span>انتخاب فیلتر اختیاری است</span></div><div class="advanced-search-grid">${selectField('status', 'وضعیت پرونده', statusOptions)}${selectField('priority', 'اولویت', priorityOptions)}${selectField('liaisonId', 'رابط (کارکنان خیریه)', liaisonOptions)}${selectField('tagId', 'برچسب پرونده', tagOptions)}${selectField('incomplete', 'تکمیل اطلاعات', incompleteOptions)}${selectField('specialistDomain', 'حوزهٔ تخصصی', domainOptions)}<label class="advanced-search-field"><span>آخرین تماس قبل از</span><input type="date" name="lastContactBefore" value="${esc(filters.lastContactBefore || '')}"></label><label class="advanced-search-field"><span>پیگیری بعدی تا</span><input type="date" name="nextFollowUpBefore" value="${esc(filters.nextFollowUpBefore || '')}"></label></div><div class="advanced-search-error" id="advancedSearchError" aria-live="polite"></div><footer class="advanced-search-actions"><button type="reset" class="secondary">پاک‌کردن فیلترها</button><button type="submit" class="primary"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>جست‌وجو در پرونده‌ها</button></footer></form><section class="advanced-search-results" id="advancedResults" aria-live="polite"></section></section></div>`;
        const root = modalRoot.querySelector('.modal-backdrop');
        root.addEventListener('click', e => { if (e.target === root)
            closeModal(); });
        modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
        const form = modalRoot.querySelector('#advancedFamilyForm'), results = modalRoot.querySelector('#advancedResults'), error = modalRoot.querySelector('#advancedSearchError');
        form.onreset = () => setTimeout(() => { results.innerHTML = ''; error.textContent = ''; }, 0);
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            error.textContent = '';
            results.innerHTML = '<div class="advanced-search-loading"><span class="spinner"></span><span>در حال جست‌وجو در پرونده‌ها…</span></div>';
            try {
                const values = Object.fromEntries(new FormData(form)), qs = new URLSearchParams(Object.entries(values).filter(([, v]) => v));
                const d = await api('/api/families/search/advanced?' + qs), rows = d.families || [];
                results.innerHTML = `<div class="advanced-results-head"><div><h3>نتایج جست‌وجو</h3><p>${values.q ? `نتایج برای «${esc(values.q)}»` : 'نتیجه بر اساس فیلترهای انتخاب‌شده'}</p></div><span class="count-chip">${fa(d.total)} پرونده</span></div>${rows.length ? `<div class="advanced-result-list">${rows.map(x => `<button type="button" class="advanced-result-card" data-advanced-family="${esc(x.id)}"><span class="advanced-result-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg></span><span class="advanced-result-copy"><span class="advanced-result-title"><b>${esc(x.headName)}</b><small>پرونده ${esc(x.caseNumber)}</small></span><span class="advanced-result-meta">${esc(x.familySurname || 'نام خانوادگی ثبت نشده')} · ${esc(x.liaisonName || 'بدون رابط')} · ${fa(x.memberCount)} عضو</span><span class="advanced-result-meta">آخرین تماس: ${esc(alertDate(x.lastContactAt) || 'ثبت نشده')} · پیگیری بعدی: ${esc(alertDate(x.nextFollowUpAt) || 'تعریف نشده')}</span>${x.tags?.length ? `<span class="advanced-result-tags">${x.tags.map(tag => `<i>${esc(tag)}</i>`).join('')}</span>` : ''}</span><span class="advanced-result-side"><span class="priority">${esc(x.priority || 'ثبت نشده')}</span><span class="advanced-result-status ${x.archived ? 'is-archived' : ''}">${x.archived ? 'آرشیوشده' : 'فعال'}</span><span class="advanced-result-arrow" aria-hidden="true">←</span></span></button>`).join('')}</div>` : '<div class="advanced-search-empty"><span aria-hidden="true">⌕</span><b>پرونده‌ای مطابق این فیلترها پیدا نشد</b><p>فیلترها را پاک کنید یا عبارت دیگری جست‌وجو کنید.</p></div>'}`;
                modalRoot.querySelectorAll('[data-advanced-family]').forEach(b => b.onclick = () => { const id = b.dataset.advancedFamily; closeModal(); loadDetail(id); });
            }
            catch (err) {
                results.innerHTML = '';
                error.textContent = err.message || 'جست‌وجو انجام نشد.';
            }
            finally {
                submit.disabled = false;
            }
        };
    }
    catch (e) {
        toast(e.message);
    }
}

async function openC7Dashboard(kind, filters = {}) { const issues = kind === 'finance' ? ReportRules.periodErrors(filters) : ReportRules.rangeErrors(filters); if (issues.length) {
    toast(issues[0].message);
    return;
} try {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)), d = await api('/api/dashboards/' + kind + (qs.toString() ? '?' + qs : ''));
    if (kind === 'ceo')
        renderCeoDashboard(d);
    else if (kind === 'supervision')
        renderSupervisionDashboard(d);
    else
        renderFinanceDashboard(d, filters);
}
catch (e) {
    toast(e.message);
} }

function c7Shell(eyebrow, title, body, exports = '') { return `<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="close-btn" data-close>×</button></div>${body}${exports}</div></div>`; }

function bindC7Close() { document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

function reportLinks(types) { return `<div class="detail-section"><h3>خروجی گزارش‌ها</h3><div class="workflow-actions">${types.flatMap(t => [['csv', 'CSV'], ['excel', 'Excel'], ['pdf', 'PDF چاپی']].map(([f, l]) => `<a class="secondary" target="_blank" href="/api/reports/management?type=${t[0]}&format=${f}">${t[1]} — ${l}</a>`)).join('')}</div></div>`; }

function renderCeoDashboard(d) {
    const requestTotal = (d.financial?.requests || []).reduce((n, x) => n + Number(x.total || 0), 0), active = Number(d.families?.active || 0), urgent = Number(d.priority?.urgent || 0), critical = Number(d.priority?.critical || 0), open = Number(d.actions?.open || 0), overdue = Number(d.actions?.overdue || 0), payments = d.financial?.payments || { amount: 0, total: 0 }, liaisons = d.distribution?.liaisons || [], maxFamilies = Math.max(1, ...liaisons.map(x => Number(x.families || 0)));
    const kpis = [
        ['خانواده‌های فعال', active, 'blue', 'active'], ['موارد فوری', urgent, 'orange', 'urgent'],
        ['اقدام‌های باز', open, 'green', 'actions'], ['اقدام‌های عقب‌افتاده', overdue, 'red', 'overdue'],
        ['درخواست‌های مالی', requestTotal, 'violet', 'finance'], ['پرداخت‌های ثبت‌شده', payments.total || 0, 'slate', 'payments']
    ];
    const content = `<section class="c7-exec-hero"><div><span class="eyebrow">مرکز راهبری سازمان</span><h3>تصویر کلی خدمات و رسیدگی</h3><p>نمای فشرده‌ای از وضعیت خانواده‌ها، پیگیری‌ها و حمایت‌های ثبت‌شده.</p></div><div class="c7-exec-alerts"><span class="c7-alert-pill ${critical ? 'is-critical' : 'is-calm'}">${fa(critical)} بحرانی</span><span class="c7-alert-pill ${urgent ? 'is-urgent' : 'is-calm'}">${fa(urgent)} فوری</span></div></section>
    <div class="c7-kpi-grid">${kpis.map(([label, value, tone, action]) => `<button type="button" class="c7-kpi c7-kpi-${tone}" data-ceo-action="${action}"><span>${label}</span><b>${fa(value)}</b><small>${action === 'active' ? 'رفتن به فهرست خانواده‌ها' : action === 'urgent' ? 'نمایش پرونده‌های فوری' : action === 'finance' ? 'بازکردن کارتابل مالی' : action === 'overdue' ? 'دیدن پیگیری‌های عقب‌افتاده' : 'مشاهده جزئیات'}</small></button>`).join('')}</div>
    <section class="c7-report-panel"><div class="c7-report-heading"><div><span class="eyebrow">پوشش خدمات</span><h3>توزیع خانواده‌ها بین رابط‌ها</h3></div><span class="count-chip">${fa(liaisons.length)} رابط</span></div>${liaisons.length ? `<div class="c7-liaison-list">${liaisons.map(x => { const count = Number(x.families || 0), width = Math.round(count / maxFamilies * 100); return `<div class="c7-liaison-row"><div class="c7-liaison-copy"><b>${esc(x.name)}</b><span>${fa(count)} خانواده</span></div><div class="c7-liaison-track"><i style="width:${width}%"></i></div></div>`; }).join('')}</div>` : '<div class="empty-state">اطلاعات توزیع رابط‌ها در دسترس نیست.</div>'}</section>
    <section class="c7-payment-summary"><div><span class="eyebrow">گزارش مالی</span><h3>پرداخت‌های انجام‌شده</h3><p>جمع پرداخت‌ها در بازهٔ انتخاب‌شده</p></div><div class="c7-payment-total"><b>${money(payments.amount || 0)}</b><span>تومان · ${fa(payments.total || 0)} پرداخت</span></div></section>`;
    AppUI.mountModal(c7Shell('', 'داشبورد مدیرعامل', content, reportLinks([['executive', 'اجرایی'], ['specialist', 'درمان و آموزش'], ['family_cost', 'هزینه خانواده']])));
    bindC7Close();
    document.querySelectorAll('[data-ceo-action]').forEach(button => button.onclick = () => { const actions = { active: () => openActiveFamilyList?.(), urgent: () => openUrgentFamilyList?.(), actions: () => openActionInbox?.(), overdue: () => openOverdue?.(), finance: () => openFinancialInbox?.(), payments: () => openC7Dashboard('finance') }; actions[button.dataset.ceoAction]?.(); });
}

function renderSupervisionDashboard(d) { AppUI.mountModal(c7Shell('', 'داشبورد معاون سرپرستی', `<div class="metric-grid">${[['گزارش منتظر تأیید', d.summary.pending_reports], ['خانواده عقب‌افتاده', d.summary.overdue_families], ['اقدام عقب‌افتاده', d.summary.overdue_actions], ['نتیجه منتظر تأیید', d.summary.pending_results]].map(x => `<div class="metric-card"><span>${x[0]}</span><b>${fa(x[1])}</b></div>`).join('')}</div><h3>عملکرد رابط‌ها</h3><div class="finance-list">${d.liaisons.map(x => `<div class="finance-card"><b>${esc(x.name)}</b><p>${fa(x.families)} خانواده · ${fa(x.reports)} گزارش · ${fa(x.on_time_percent)}٪ به‌موقع · ${fa(x.overdue_actions)} اقدام عقب‌افتاده</p></div>`).join('')}</div><h3>خانواده‌های بدون پیگیری کافی</h3><div class="finance-list">${d.untrackedFamilies.slice(0, 50).map(x => `<button class="family-item" data-c7-family="${x.familyId}"><b>${esc(x.caseNumber)} · ${esc(x.headName)}</b><p>${esc(x.liaisonName || 'بدون رابط')} · موعد ${esc(x.nextDueAt || 'تعریف‌نشده')}</p></button>`).join('') || '<div class="empty-state">موردی وجود ندارد.</div>'}</div>`, reportLinks([['liaison', 'عملکرد رابط']]))); bindC7Close(); document.querySelectorAll('[data-c7-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.c7Family); }); }

function renderFinanceDashboard(d, filters) {
    const pending = d.pending || [], categories = d.byCategory || [], sumCategories = categories.reduce((n, x) => n + Number(x.amount || 0), 0);
    const content = `<form id="c7FinanceFilter" class="c7-finance-filters"><div class="form-field"><label>سال شمسی</label><input name="jalaliYear" type="number" min="1300" max="${ReportRules.currentPeriod().year}" value="${esc(filters.jalaliYear || '')}"></div><div class="form-field"><label>ماه</label><input name="jalaliMonth" type="number" min="1" max="12" value="${esc(filters.jalaliMonth || '')}"></div><button class="secondary" type="submit">اعمال بازه</button></form>
    <section class="c7-finance-hero"><div><span class="eyebrow">پیش‌بینی ماه آینده</span><h3>برآورد نیاز مالی</h3><p>میانگین سه دورهٔ اخیر؛ برای برنامه‌ریزی حمایت‌ها.</p></div><div class="c7-finance-forecast"><b>${money(d.forecastNextMonth || 0)}</b><span>تومان</span></div></section>
    <div class="c7-finance-stats"><div class="c7-finance-stat"><span>درخواست‌های منتظر اقدام</span><b>${fa(pending.length)}</b></div><div class="c7-finance-stat"><span>پرداخت در دسته‌بندی‌های ثبت‌شده</span><b>${money(sumCategories)} <small>تومان</small></b></div></div>
    <section class="c7-report-panel"><div class="c7-report-heading"><div><span class="eyebrow">نیازمند رسیدگی</span><h3>درخواست‌های معطل</h3></div><span class="count-chip">${fa(pending.length)} درخواست</span></div><div class="c7-pending-list">${pending.slice(0, 50).map(x => `<button type="button" class="c7-pending-row" data-c7-family="${esc(x.familyId)}"><span class="c7-pending-icon">↗</span><span class="c7-pending-copy"><b>${esc(x.title || 'درخواست مالی')}</b><small>پرونده ${esc(x.caseNumber || '—')} · ${esc(x.status || 'در انتظار اقدام')}</small></span><strong>${money(x.approvedAmount || x.amount || 0)} <small>تومان</small></strong><span aria-hidden="true">←</span></button>`).join('') || '<div class="empty-state">در حال حاضر درخواست معطلی وجود ندارد.</div>'}</div></section>
    <section class="c7-report-panel"><div class="c7-report-heading"><div><span class="eyebrow">ترکیب پرداخت</span><h3>پرداخت بر اساس موضوع</h3></div><span class="count-chip">${fa(categories.length)} دسته</span></div><div class="c7-category-list">${categories.map(x => `<div class="c7-category-row"><span>${esc(x.category || 'سایر')}</span><b>${money(x.amount || 0)} <small>تومان</small></b></div>`).join('') || '<div class="empty-state">اطلاعات دسته‌بندی پرداخت ثبت نشده است.</div>'}</div></section>`;
    AppUI.mountModal(c7Shell('', 'داشبورد مالی', content, reportLinks([['monthly', 'گزارش ماهانه'], ['family_cost', 'هزینه خانواده']])));
    bindC7Close();
    $('#c7FinanceFilter').onsubmit = e => { e.preventDefault(); openC7Dashboard('finance', Object.fromEntries(new FormData(e.currentTarget))); };
}
