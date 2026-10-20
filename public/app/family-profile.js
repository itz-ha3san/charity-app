/* Feature: family-profile. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
async function loadFamilies() { const list = $('#familyList'); list.innerHTML = '<div class="panel-loading"><div class="skeleton-stack" aria-label="در حال بارگذاری"><span></span><span></span><span></span><span></span></div></div>'; const query = new URLSearchParams({ status: $('#statusFilter').value }); const sf = $('#supervisorFilter'), lf = $('#liaisonFilter'); if (sf?.value)
    query.set('supervisorId', sf.value); if (lf?.value)
    query.set('liaisonId', lf.value); if ($('#searchInput')?.value.trim())
    query.set('search', $('#searchInput').value.trim()); try {
    const data = await api('/api/families?' + query);
    $('#familyCount').textContent = fa(data.total) + ' پرونده';
    if (!data.families.length) {
        list.innerHTML = '<div class="empty-state"><div><b>پرونده‌ای پیدا نشد</b><p>فیلتر را تغییر دهید یا فایل JSON وارد کنید.</p></div></div>';
        $('#familyDetail').innerHTML = '<div class="empty-state">پرونده‌ای برای نمایش وجود ندارد.</div>';
        return;
    }
    list.innerHTML = data.families.map(f => `<div class="family-item-row" data-family-surname="${esc(f.familySurname)}" data-case-number="${esc(f.caseNumber)}" data-member-count="${esc(f.memberCount)}"><button class="family-item ${f.id === selectedId ? 'active' : ''} ${f.archived ? 'archived' : ''}" data-id="${esc(f.id)}"><div class="family-item-head"><b>${esc(f.headName)}</b><span class="priority">${f.archived ? 'آرشیوشده' : esc(f.priority)}</span></div><p>${esc(f.familySurname)} · پرونده ${esc(f.caseNumber)} · ${fa(f.memberCount)} عضو</p></button><button type="button" class="quick-preview-btn" aria-label="پیش‌نمایش سریع پرونده ${esc(f.headName)}">پیش‌نمایش</button></div>`).join('');
    list.querySelectorAll('.family-item[data-id]').forEach(b => b.onclick = () => openFamilyRecord(b.dataset.id));
    const routeId = getFamilyRouteId();
    if (routeId)
        loadDetail(routeId);
    else if (!selectedId || !data.families.some(f => f.id === selectedId))
        loadDetail(data.families[0].id);
}
catch (e) {
    if (e.status === 401)
        return showAuth(true);
    list.innerHTML = '<div class="empty-state"><div><b>دریافت فهرست ناموفق بود</b><p>ارتباط با Backend را بررسی کنید.</p></div></div>';
} }

const dataLabels = { headIban:'شماره شبا', accountHolder:'نام صاحب حساب', accountRelation:'نسبت صاحب حساب', province:'استان', city:'شهر', village:'روستا / آبادی', postalCode:'کد پستی', id: 'شناسه', caseNumber: 'شماره پرونده', familySurname: 'نام خانوادگی', headName: 'نام فرد اصلی خانوار', headRelation: 'نسبت با فرد اصلی خانوار', headNationalId: 'کد ملی فرد اصلی خانوار', headBirthDate: 'تاریخ تولد فرد اصلی خانوار', headPhone: 'شماره تماس فرد اصلی خانوار', familyPhone: 'تلفن خانوار', headEducation: 'تحصیلات فرد اصلی خانوار', headJob: 'شغل فرد اصلی خانوار', incomeDescription: 'شرح درآمد', insurance: 'بیمه', medical: 'وضعیت درمانی', members: 'اعضای خانواده', housing: 'اطلاعات مسکن', debt: 'بدهی', transportationCost: 'هزینه رفت‌وآمد', utilityCost: 'هزینه قبوض', monthlyInstallments: 'اقساط ماهانه', monthlyAid: 'کمک ماهانه', monthlyAidHistory: 'کمک‌های ثبت‌شده', caseItems: 'موارد پیگیری', notesHistory: 'یادداشت‌های قبلی', notes: 'یادداشت پرونده', priority: 'اولویت', nextFollowUp: 'پیگیری بعدی', sponsor: 'حامی', archived: 'وضعیت بایگانی', documents: 'مدارک', name: 'نام', relation: 'نسبت خانوادگی', nationalId: 'کد ملی', birthDate: 'تاریخ تولد', education: 'تحصیلات', job: 'شغل', type: 'نوع', cost: 'هزینه', renewalDate: 'تاریخ تمدید', field: 'رشته تحصیلی', universityTerm: 'پایه یا ترم تحصیلی', level: 'مقطع تحصیلی', grades: 'نمرات', school: 'مدرسه', institution: 'مرکز آموزشی', hasCondition: 'وضعیت بیماری', description: 'توضیحات', monthlyCost: 'هزینه ماهانه', deposit: 'ودیعه', monthlyRent: 'اجاره ماهانه', leaseRenewalDate: 'موعد تمدید اجاره', monthlyIncome: 'حقوق ماهانه', address: 'نشانی', amount: 'مبلغ', reason: 'علت', status: 'وضعیت', text: 'متن', institutionNote: 'یادداشت مؤسسه', title: 'عنوان', category: 'دسته‌بندی', date: 'تاریخ', event: 'رویداد', action: 'اقدام', note: 'یادداشت', summary: 'خلاصه', result: 'نتیجه', domain: 'حوزه', urgency: 'میزان فوریت', from: 'وضعیت پیشین', to: 'وضعیت جدید', followUpStatus: 'وضعیت پیگیری', nextFollowUpAt: 'موعد پیگیری بعدی', liaisonName: 'رابط خیریه', supervisorName: 'سرپرست ارتباط خانواده', insuranceType: 'نوع بیمه', insuranceCost: 'هزینه بیمه', housingType: 'نوع سکونت', housingDeposit: 'ودیعه مسکن', housingRent: 'اجاره ماهانه', assignedTo: 'مسئول پیگیری', assigneeName: 'مسئول پیگیری', actorName: 'ثبت‌کننده' };

const label = k => dataLabels[k] || (/[A-Za-z]/.test(String(k)) ? 'سایر اطلاعات' : String(k));

const profileValueLabels = { rent: 'استیجاری', owned: 'ملکی', relative: 'منزل بستگان', with_family: 'زندگی با خانواده', other: 'سایر', active: 'فعال', inactive: 'غیرفعال', pending: 'در انتظار بررسی', approved: 'تأییدشده', rejected: 'ردشده', in_progress: 'در حال انجام', completed: 'انجام‌شده', cancelled: 'لغوشده', monthly: 'ماهانه', ad_hoc: 'موردی', normal: 'عادی', urgent: 'فوری', critical: 'بحرانی', important: 'مهم', low: 'کم', high: 'بالا', health: 'درمان', education: 'آموزش', medical: 'درمان', health_insurance: 'بیمه درمانی', prescription: 'نسخه', medical_record: 'مدرک پزشکی', education_report: 'گزارش آموزشی', school_document: 'مدرک مدرسه', cost_estimate: 'برآورد هزینه', supporting_document: 'مدرک پشتیبان', ad_hoc: 'موردی', phone: 'تماس تلفنی', message: 'پیام', in_person: 'حضوری', draft: 'پیش‌نویس', submitted: 'ارسال‌شده', revision_requested: 'نیازمند اصلاح', create: 'ثبت', update: 'ویرایش', delete: 'حذف', archive: 'بایگانی', restore: 'بازگردانی', family_create: 'ایجاد پرونده', family_update: 'ویرایش پرونده', financial_create: 'ثبت درخواست مالی', financial_update: 'ویرایش درخواست مالی', financial_approve: 'تأیید درخواست مالی', financial_reject: 'رد درخواست مالی', financial_payment: 'پرداخت درخواست مالی', specialist_create: 'ارجاع تخصصی', supervision_report: 'گزارش تماس', health_officer: 'کارشناس درمان', education_officer: 'کارشناس آموزش', caseworker: 'کارشناس پرونده', admin: 'مدیر سامانه', ceo: 'مدیرعامل', spouse: 'همسر', child: 'فرزند', parent: 'والد', sibling: 'خواهر یا برادر', guardian: 'سرپرست قانونی', single: 'مجرد', married: 'متأهل' };

function profileDisplayValue(value) { if (typeof value !== 'string')
    return value; const mapped = profileValueLabels[value]; if (mapped)
    return mapped; const event = value.replace(/[.\-]/g, '_').toLowerCase(); return profileValueLabels[event] || value; }

const historyTechnicalKeys = new Set(['id', 'caseid', 'familyid', 'memberid', 'noteid', 'actionid', 'reportid', 'financialcaseid', 'specialistcaseid', 'assigneeid', 'assignedtoid', 'liaisonid', 'supervisorid', 'createdat', 'updatedat', 'createdby', 'createdbyid', 'createdbyname', 'updatedby', 'updatedbyid', 'assigneename', 'assignedto', 'assignedtoname', 'assignedby', 'assignedbyid', 'assignedbyname', 'deletedat', 'deletedby', 'recordid', 'organizationid', 'user_id', 'created_at', 'updated_at']);

function profileIsTechnicalHistoryKey(key) { const normalized = String(key).replace(/[_-]/g, '').toLowerCase(); return historyTechnicalKeys.has(normalized) || /(?:^id$|Id$|ID$|_id$|-id$|_created_at$|_updated_at$)/.test(String(key)) || /^(?:assigned|assignee|creator|updater).*(?:id|name)$/i.test(String(key)); }

function cleanProfileHistoryValue(value) { if (Array.isArray(value))
    return value.map(cleanProfileHistoryValue).filter(v => v !== null && v !== undefined && v !== ''); if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (profileIsTechnicalHistoryKey(k))
            continue;
        const clean = cleanProfileHistoryValue(v);
        if (clean !== null && clean !== undefined && clean !== '')
            out[k] = clean;
    }
    return Object.keys(out).length ? out : null;
} return profileDisplayValue(value); }

function profileHasValue(v) { if (v === null || v === undefined || v === '')
    return false; if (Array.isArray(v))
    return v.some(profileHasValue); if (typeof v === 'object')
    return Object.values(v).some(profileHasValue); return true; }

function renderProfileNationalId(v) { const raw = String(v ?? '').trim(), digits = (raw.match(/[0-9۰-۹٠-٩]/g) || []).length; if (!digits)
    return esc(raw); let left = Math.max(0, digits - 4), masked = raw.replace(/[0-9۰-۹٠-٩]/g, ch => left > 0 ? (left--, '•') : ch); return `<span class="profile-id-value" dir="ltr" data-profile-id-value data-full="${esc(raw)}" data-masked="${esc(masked)}">${esc(masked)}</span><button class="profile-id-toggle" type="button" data-profile-id-toggle aria-pressed="false">نمایش</button>`; }

function profileWideField(k, v) { return k === 'members' || Array.isArray(v) && v.length > 0 || ['headEducation', 'education', 'insurance', 'medical', 'housing', 'debt'].includes(String(k)) && v !== null && typeof v === 'object' || ['address', 'incomeDescription', 'description', 'notes', 'notesHistory', 'caseItems', 'monthlyAidHistory', 'documents'].includes(String(k)) || (typeof v === 'string' && v.length > 100); }

function profileObject(v, defaults = []) { const source = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; return { ...Object.fromEntries(defaults.map(k => [k, null])), ...source }; }

function profileEducation(v) { if (v === null || v === undefined || v === '')
    return null; if (typeof v === 'string')
    return v; return profileObject(v, ['level', 'description', 'field', 'universityTerm', 'grades']); }

function renderProfileMembers(value, options = {}) { if (!Array.isArray(value) || !value.length)
    return renderDataValue(value); const { canWrite = false } = options, standard = ['relation', 'birthDate', 'job', 'education', 'nationalId']; return `<div class="profile-members-list">${value.map((raw, i) => { const member = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { name: raw }, extras = Object.keys(member).filter(k => !['id', 'name', ...standard].includes(k)), fields = [...standard, ...extras].map(k => { const v = k === 'education' ? profileEducation(member[k]) : member[k] ?? null; return `<div class="profile-member-field ${profileWideField(k, v) ? 'is-wide' : ''} ${profileHasValue(v) ? '' : 'is-empty'}"><span>${esc(label(k))}</span><div>${renderProfileValue(k, v)}</div>${!profileHasValue(v) ? profileInlineEditButton('members', canWrite, 'root') : ''}</div>`; }).join(''); return `<article class="profile-member-card"><header><span class="profile-member-index">${fa(i + 1)}</span><strong>${esc(member.name || 'نام عضو ثبت نشده')}</strong></header><div class="profile-member-fields">${fields}</div></article>`; }).join('')}</div>`; }

function renderProfileValue(k, v) { if (k === 'members')
    return renderProfileMembers(v); if (/national.?id/i.test(String(k)) && v !== null && v !== undefined && v !== '' && (typeof v === 'string' || typeof v === 'number'))
    return renderProfileNationalId(v); return renderDataValue(v); }

function renderDataValue(v) { if (v === null || v === undefined || v === '')
    return '<span class="profile-empty-value">ثبت نشده</span>'; if (typeof v === 'boolean')
    return v ? 'بله' : 'خیر'; if (typeof v === 'number')
    return fa(v); if (Array.isArray(v))
    return v.length ? `<div class="data-array">${v.map((x, i) => `<div class="data-node ${profileWideField('item', x) ? 'is-wide' : ''} ${profileHasValue(x) ? '' : 'is-empty'}"><span class="data-key">مورد ${fa(i + 1)}</span>${renderDataValue(x)}</div>`).join('')}</div>` : '<span class="profile-empty-value">موردی ثبت نشده</span>'; if (typeof v === 'object')
    return `<div class="data-object">${Object.entries(v).map(([k, x]) => `<div class="data-node ${profileWideField(k, x) ? 'is-wide' : ''} ${profileHasValue(x) ? '' : 'is-empty'}"><span class="data-key">${esc(label(k))}</span><div class="data-value">${renderProfileValue(k, x)}</div></div>`).join('')}</div>`; return esc(profileDisplayValue(v)); }

function profileValueIsPlaceholder(value) { return typeof value === 'string' && /^(?:ثبت نشده|مشخص نشده|شغل ثبت نشده|اطلاعات شغلی ثبت نشده|شرح درآمد ثبت نشده(?: است)?|منبع درآمد مشخص نشده(?: است)?)$/u.test(value.trim()); }

function profileLeafStats(value) { if (value === null || value === undefined || value === '' || profileValueIsPlaceholder(value))
    return { total: 1, filled: 0 }; if (Array.isArray(value)) {
    if (!value.length)
        return { total: 1, filled: 0 };
    return value.reduce((a, x) => { const b = profileLeafStats(x); return { total: a.total + b.total, filled: a.filled + b.filled }; }, { total: 0, filled: 0 });
} if (typeof value === 'object') {
    const entries = Object.values(value);
    if (!entries.length)
        return { total: 1, filled: 0 };
    return entries.reduce((a, x) => { const b = profileLeafStats(x); return { total: a.total + b.total, filled: a.filled + b.filled }; }, { total: 0, filled: 0 });
} return { total: 1, filled: 1 }; }

function profileCompactValue(value) { return profileHasValue(value) ? `<span class="profile-ei-value">${renderProfileValue('', value)}</span>` : '<span class="profile-empty-value">ثبت نشده</span>'; }

function renderEducationWorkIncome(data, options = {}) { const raw = data.headEducation, education = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { level: raw || null }, level = education.level ?? education.degree ?? '', description = education.description ?? null, detailsMap = new Map([['field', education.field ?? null], ['universityTerm', education.universityTerm ?? null], ['grades', education.grades ?? null]]); if (profileHasValue(description) && String(description).trim() !== String(level ?? '').trim())
    detailsMap.set('description', description); Object.entries(education).forEach(([key, value]) => { if (!['level', 'degree', 'description'].includes(key) && !detailsMap.has(key))
    detailsMap.set(key, value); }); const details = [...detailsMap.entries()], statsEducation = { ...education, field: education.field ?? null, universityTerm: education.universityTerm ?? null, grades: education.grades ?? null }; if (String(description ?? '').trim() === String(level ?? '').trim())
    delete statsEducation.description; const stats = profileLeafStats({ ...data, headEducation: statsEducation }); const job = profileValueIsPlaceholder(data.headJob) ? null : data.headJob, income = profileValueIsPlaceholder(data.incomeDescription) ? null : data.incomeDescription; return `<div class="profile-ei-grid"><article class="profile-ei-card profile-ei-education" data-profile-field><header class="profile-ei-card-head"><span class="profile-ei-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z"/><path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5M21.5 9v6"/></svg></span><span class="profile-ei-title"><small>وضعیت تحصیلی</small><strong>${esc(level || 'مقطع تحصیلی ثبت نشده')}</strong></span><span class="profile-ei-state ${profileHasValue(level) ? 'is-filled' : 'is-empty'}">${profileHasValue(level) ? 'ثبت‌شده' : 'نیازمند تکمیل'}</span></header>${profileHasValue(description) && String(description).trim() !== String(level).trim() ? `<p class="profile-ei-note">${esc(description)}</p>` : ''}<div class="profile-ei-details">${details.map(([key, value]) => `<div class="profile-ei-detail ${profileHasValue(value) ? '' : 'is-empty'}"><span>${esc(label(key))}</span>${profileCompactValue(value)}${!profileHasValue(value) ? profileInlineEditButton('headEducation', options.canWrite, 'education') : ''}</div>`).join('') || '<div class="profile-ei-detail is-empty"><span>جزئیات تکمیلی</span><span class="profile-empty-value">ثبت نشده</span></div>'}</div></article><article class="profile-ei-card profile-ei-job" data-profile-field><header class="profile-ei-card-head"><span class="profile-ei-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></svg></span><span class="profile-ei-title"><small>اشتغال فرد اصلی خانوار</small><strong>${esc(job || 'اطلاعات شغلی ثبت نشده')}</strong></span><span class="profile-ei-state ${profileHasValue(job) ? 'is-filled' : 'is-empty'}">${profileHasValue(job) ? 'ثبت‌شده' : 'نیازمند تکمیل'}</span></header><div class="profile-ei-empty-copy">${profileHasValue(job) ? 'وضعیت شغلی در پرونده ثبت شده است.' : 'وضعیت اشتغال هنوز در پرونده وارد نشده است.'}${!profileHasValue(job) ? profileInlineEditButton('headJob', options.canWrite, 'root') : ''}</div></article><article class="profile-ei-card profile-ei-income" data-profile-field><header class="profile-ei-card-head"><span class="profile-ei-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-13 5h4"/></svg></span><span class="profile-ei-title"><small>منابع درآمد خانوار</small><strong>${profileHasValue(income) ? 'شرح درآمد' : 'شرح درآمد ثبت نشده'}</strong></span><span class="profile-ei-state ${profileHasValue(income) ? 'is-filled' : 'is-empty'}">${profileHasValue(income) ? 'ثبت‌شده' : 'نیازمند تکمیل'}</span></header><div class="profile-ei-income-copy ${profileHasValue(income) ? '' : 'is-empty'}">${profileHasValue(income) ? esc(income) : 'منبع یا توضیح درآمد خانواده ثبت نشده است.'}${!profileHasValue(income) ? profileInlineEditButton('incomeDescription', options.canWrite, 'root') : ''}</div></article></div>`; }

function profileInlineEditKey(key, scope = 'root') { const aliases = { insurance: { type: 'insurance', cost: 'insurance', renewalDate: 'insurance' }, medical: { hasCondition: 'medical', description: 'medical', monthlyCost: 'medical' }, housing: { type: 'housingType', deposit: 'housingCost', monthlyRent: 'housingRent', rent: 'housingRent', leaseRenewalDate: 'housingLeaseRenewalDate', address: 'address' }, finance: { debt: 'debt', amount: 'debt', reason: 'debt', transportationCost: 'transportationCost', utilityCost: 'utilityCost', monthlyInstallments: 'monthlyInstallments', monthlyAid: 'monthlyAid' }, education: { level: 'headEducation', degree: 'headEducation', field: 'headEducation', universityTerm: 'headEducation', grades: 'headEducation', description: 'headEducation' }, support: { priority: 'priority', nextFollowUp: 'nextFollowUp', sponsor: 'sponsor' }, root: { caseNumber: 'caseNumber', familySurname: 'familySurname', headName: 'headName', headNationalId: 'headNationalId', headBirthDate: 'headBirthDate', headPhone: 'headPhone', familyPhone: 'familyPhone', headEducation: 'headEducation', headJob: 'headJob', incomeDescription: 'incomeDescription', insurance: 'insurance', medical: 'medical', housing: 'housingType', housingType: 'housingType', housingDeposit: 'housingCost', housingRent: 'housingRent', address: 'address', debt: 'debt', transportationCost: 'transportationCost', utilityCost: 'utilityCost', monthlyInstallments: 'monthlyInstallments', monthlyAid: 'monthlyAid', priority: 'priority', nextFollowUp: 'nextFollowUp', sponsor: 'sponsor', notes: 'notes', members: 'members' } }; return aliases[scope]?.[key] || aliases.root[key] || null; }

function profileInlineEditButton(key, canWrite, scope = 'root') { const target = profileInlineEditKey(key, scope), isRequest = actor?.position === 'liaison', action = isRequest ? 'درخواست اصلاح' : 'ویرایش'; return canWrite && target ? `<button type="button" class="profile-inline-edit" data-profile-inline-edit="${esc(target)}" aria-label="${action} ${esc(label(key))}" title="${action} همین مورد"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>${action}</span></button>` : ''; }

function renderProfileTopicFields(data, options = {}) { const { canWrite = false, scope = 'root' } = options; return `<div class="profile-topic-fields">${Object.entries(data || {}).map(([k, v]) => `<div class="profile-topic-field ${profileHasValue(v) ? '' : 'is-empty'}" data-profile-field data-profile-key="${esc(k)}"><span>${esc(label(k))}</span><div class="profile-topic-value">${profileCompactValue(v)}</div>${!profileHasValue(v) ? profileInlineEditButton(k, canWrite, scope) : ''}</div>`).join('')}</div>`; }

function renderProfileTopicCard(title, icon, data, wide = false, options = {}) { return `<article class="profile-topic-card ${wide ? 'is-wide' : ''}"><header><span class="profile-topic-icon" aria-hidden="true">${icon}</span><strong>${esc(title)}</strong></header>${renderProfileTopicFields(data, options)}</article>`; }

function renderProfileHistory(data) { const titles = { monthlyAidHistory: 'کمک‌های قبلی', caseItems: 'موارد ثبت‌شده', notesHistory: 'یادداشت‌های پیگیری', notes: 'یادداشت پرونده' }; return `<div class="profile-history-list">${Object.entries(data || {}).map(([key, raw]) => { const value = cleanProfileHistoryValue(raw); if (!profileHasValue(value))
    return ''; const records = Array.isArray(value) ? value : [value]; return `<section class="profile-history-group"><header><strong>${titles[key] || label(key)}</strong><span>${fa(records.length)} مورد</span></header><div class="profile-history-records">${records.map((record, index) => { if (record && typeof record === 'object' && !Array.isArray(record)) {
    const entries = Object.entries(record);
    if (!entries.length)
        return '';
    const headline = record.title || record.category || record.text || record.action || record.summary;
    return `<article class="profile-history-record">${headline ? `<strong>${esc(profileDisplayValue(String(headline)))}</strong>` : `<strong>${titles[key] || label(key)} · ${fa(index + 1)}</strong>`}${renderProfileTopicFields(Object.fromEntries(entries.filter(([k]) => !['title', 'category', 'text', 'action', 'summary'].includes(k))), { scope: 'history' })}</article>`;
} return `<article class="profile-history-record"><strong>${esc(titles[key] || label(key))} · ${fa(index + 1)}</strong><p>${esc(String(record))}</p></article>`; }).join('')}</div></section>`; }).join('') || '<div class="profile-attachment-empty">هنوز سابقه یا یادداشتی ثبت نشده است.</div>'}</div>`; }

function renderProfileDocumentSlot(slot, category, canWrite, familyId) { return `<section class="profile-attachment-slot" data-family-attachments="${slot}"><div class="profile-attachment-head"><div><strong>${slot === 'medical' ? 'پیوست‌های درمانی' : slot === 'education' ? 'پیوست‌های آموزشی' : slot === 'housing' ? 'اسناد مسکن و دارایی' : slot === 'financial' ? 'اسناد مالی' : 'مدارک تکمیلی پرونده'}</strong><small>${slot === 'housing' ? 'مرتبط با اطلاعات مسکن این خانواده' : 'پیوست‌های دسته‌بندی‌شده همین حوزه'}</small></div>${canWrite ? `<button class="secondary profile-attach-btn" type="button" data-profile-upload="${category}" data-family-id="${esc(familyId || '')}">＋ افزودن سند</button>` : ''}</div><div class="profile-attachment-list"><span class="muted">در حال دریافت پیوست‌ها…</span></div></section>`; }

function renderProfileSection(title, icon, data, initialOpen = false, options = {}) { const entries = Object.entries(data); if (!entries.length)
    return ''; const { canWrite = false, familyId = '' } = options, isEducationSection = title === 'تحصیلات، شغل و درآمد', isHealth = title === 'بیمه و وضعیت درمانی', isHousing = title === 'مسکن و وضعیت مالی', isMembers = title === 'اعضای خانواده', isSupport = title === 'حمایت و پیگیری', isHistory = title === 'سوابق و یادداشت‌ها', isOther = title === 'سایر اطلاعات'; const stats = isEducationSection ? (() => { const education = data.headEducation && typeof data.headEducation === 'object' && !Array.isArray(data.headEducation) ? { ...data.headEducation } : {}; education.field = education.field ?? null; education.universityTerm = education.universityTerm ?? null; education.grades = education.grades ?? null; if (String(education.description ?? '').trim() === String(education.level ?? '').trim())
    delete education.description; return profileLeafStats({ ...data, headEducation: education }); })() : { total: entries.reduce((n, [, v]) => n + profileLeafStats(v).total, 0), filled: entries.reduce((n, [, v]) => n + profileLeafStats(v).filled, 0) }; let body = ''; if (isEducationSection) {
    body = `${renderEducationWorkIncome(data, { canWrite, familyId })}${renderProfileDocumentSlot('education', 'آموزشی', canWrite, familyId)}`;
}
else if (isHealth) {
    body = `<div class="profile-topic-grid profile-topic-grid-health">${renderProfileTopicCard('بیمه', '✚', data.insurance || {}, false, { canWrite, scope: 'insurance' })}${renderProfileTopicCard('وضعیت درمانی', '♡', data.medical || {}, false, { canWrite, scope: 'medical' })}</div>${renderProfileDocumentSlot('medical', 'درمانی', canWrite, familyId)}`;
}
else if (isHousing) {
    const housing = data.housing || {}, finance = {};
    for (const k of ['debt', 'transportationCost', 'utilityCost', 'monthlyInstallments', 'monthlyAid'])
        if (Object.prototype.hasOwnProperty.call(data, k))
            finance[k] = data[k];
    body = `<div class="profile-topic-grid profile-topic-grid-housing">${renderProfileTopicCard('مسکن و اجاره', '⌂', housing, false, { canWrite, scope: 'housing' })}${renderProfileTopicCard('وضعیت مالی خانوار', 'تومان', finance, false, { canWrite, scope: 'finance' })}</div><div class="profile-topic-attachment-row">${renderProfileDocumentSlot('housing', 'مسکن', canWrite, familyId)}${renderProfileDocumentSlot('financial', 'مالی', canWrite, familyId)}</div>`;
}
else if (isMembers) {
    const members = Array.isArray(data.members) ? data.members : [];
    body = `<div class="profile-topic-intro"><strong>${fa(members.length)} عضو</strong><span>اطلاعات هر عضو در کارت مستقل نمایش داده می‌شود.</span></div>${renderProfileMembers(members, { canWrite })}`;
}
else if (isSupport) {
    body = `<div class="profile-topic-grid profile-topic-grid-support">${renderProfileTopicCard('اولویت پرونده', '◎', { priority: data.priority }, false, { canWrite, scope: 'support' })}${renderProfileTopicCard('پیگیری بعدی', '◷', { nextFollowUp: data.nextFollowUp }, false, { canWrite, scope: 'support' })}${renderProfileTopicCard('رابط و سرپرست ارتباط', '♧', { liaisonName: data.liaisonName, supervisorName: data.supervisorName, sponsor: data.sponsor }, false, { canWrite, scope: 'support' })}${renderProfileTopicCard('وضعیت پرونده', '▣', { archived: data.archived }, false, { canWrite, scope: 'support' })}</div>`;
}
else if (isHistory) {
    const history = {};
    for (const k of ['monthlyAidHistory', 'caseItems', 'notesHistory', 'notes'])
        if (Object.prototype.hasOwnProperty.call(data, k))
            history[k] = data[k];
    body = `${renderProfileHistory(history)}${renderProfileDocumentSlot('other', 'سایر', canWrite, familyId)}`;
}
else if (isOther) {
    body = `<div class="profile-topic-grid profile-topic-grid-other">${entries.map(([k, v]) => renderProfileTopicCard(label(k), '•', { [k]: v }, profileWideField(k, v), { canWrite, scope: 'root' })).join('')}</div>`;
}
else {
    body = `<div class="profile-grid">${entries.map(([k, v]) => `<div class="profile-field ${profileWideField(k, v) ? 'wide' : ''} ${profileHasValue(v) ? '' : 'is-empty'}" data-profile-field><span class="data-key">${esc(label(k))}</span><div class="data-value">${renderProfileValue(k, v)}</div>${!profileHasValue(v) ? profileInlineEditButton(k, canWrite, 'root') : ''}</div>`).join('')}</div>`;
} const modClass = [isEducationSection ? 'profile-section-education' : '', isHealth ? 'profile-section-health' : '', isHousing ? 'profile-section-housing' : '', isMembers ? 'profile-section-members' : '', isSupport ? 'profile-section-support' : '', isHistory ? 'profile-section-history' : '', isOther ? 'profile-section-other' : ''].filter(Boolean).join(' '); return `<details class="profile-section ${modClass}" data-profile-section data-initial-open="${initialOpen ? 'true' : 'false'}" ${initialOpen ? 'open' : ''}><summary class="profile-section-head"><span class="profile-section-icon" aria-hidden="true">${icon}</span><span class="profile-section-title"><strong>${esc(title)}</strong><small>${fa(stats.filled)} از ${fa(stats.total)} فیلد دارای مقدار</small></span><span class="profile-section-count">${fa(stats.total)} فیلد</span><span class="profile-section-chevron" aria-hidden="true"></span></summary>${body}</details>`; }

function renderFullProfile(f, canWrite = false) {
    if (f.profileRestricted)
        return '<section class="full-profile-section"><div class="archive-banner">دسترسی شما به خلاصه پرونده محدود است؛ اطلاعات هویتی، اعضا و پروفایل حساس نمایش داده نمی‌شود.</div></section>';
    if (!(actor?.role === 'admin' || ['ceo', 'liaison'].includes(actor?.position)) || actor?.position === 'liaison' && !f.profileData)
        return '';
    const p = f.profileData && typeof f.profileData === 'object' && !Array.isArray(f.profileData) ? f.profileData : {}, d = { ...p }, choose = (key, fallback) => profileHasValue(fallback) ? fallback : profileHasValue(p[key]) ? p[key] : p[key] ?? null, firstDefined = (...values) => values.find(v => v !== null && v !== undefined && v !== ''), housingInput = profileObject(p.housing || f.housing), housingTypeMap = { rent: 'استیجاری', owned: 'ملکی', relative: 'منزل بستگان', with_family: 'زندگی با خانواده', other: 'سایر' }, rawHousingType = firstDefined(housingInput.type, p.housingType, f.housingType), housingType = rawHousingType ? (Object.prototype.hasOwnProperty.call(housingTypeMap, rawHousingType) ? housingTypeMap[rawHousingType] : rawHousingType) : null;
    d.caseNumber = choose('caseNumber', f.caseNumber);
    d.familySurname = choose('familySurname', f.familySurname);
    d.headName = choose('headName', f.headName);
    d.headRelation = choose('headRelation', null);
    d.headNationalId = choose('headNationalId', f.headNationalId);
    d.headBirthDate = choose('headBirthDate', f.headBirthDate);
    d.headPhone = choose('headPhone', f.headPhone);
    d.familyPhone = choose('familyPhone', f.familyPhone);
    d.headEducation = profileEducation(choose('headEducation', f.headEducation));
    d.headJob = choose('headJob', f.headJob);
    d.incomeDescription = choose('incomeDescription', f.incomeDescription);
    if (profileValueIsPlaceholder(d.headJob))
        d.headJob = null;
    if (profileValueIsPlaceholder(d.incomeDescription))
        d.incomeDescription = null;
    d.insurance = profileObject(choose('insurance', f.insurance), ['type', 'cost', 'renewalDate']);
    d.medical = profileObject(choose('medical', f.medical), ['hasCondition', 'description', 'monthlyCost']);
    const savedHousing = p.housing && typeof p.housing === 'object' && !Array.isArray(p.housing) ? p.housing : {}, legacyDeposit = profileHasValue(p.housingDeposit) ? p.housingDeposit : Number(f.housingDeposit) > 0 ? f.housingDeposit : null, legacyRent = profileHasValue(p.housingRent) ? p.housingRent : Number(f.housingRent) > 0 ? f.housingRent : null;
    const housingExtras = { ...housingInput };
    delete housingExtras.rent;
    d.housing = { ...housingExtras, type: housingType, deposit: firstDefined(savedHousing.deposit, p.housingDeposit, legacyDeposit) ?? null, monthlyRent: firstDefined(savedHousing.monthlyRent, savedHousing.rent, p.housingRent, legacyRent) ?? null, address: firstDefined(savedHousing.address, p.address, f.address) ?? null };
    const savedMembers = Array.isArray(p.members) ? p.members : [], currentMembers = Array.isArray(f.members) ? f.members : [];
    if (currentMembers.length) {
        const unused = [...savedMembers];
        d.members = currentMembers.map((member, index) => { let match = unused.findIndex(x => x && member && x.name && x.name === member.name); if (match < 0 && unused[index] && unused[index].name === member?.name)
            match = index; const saved = match >= 0 ? unused.splice(match, 1)[0] : {}; return { ...saved, ...member, education: profileEducation(member.education ?? saved.education) }; });
    }
    else
        d.members = savedMembers.map(m => ({ ...m, education: profileEducation(m?.education) }));
    d.debt = profileObject(choose('debt', f.debt), ['amount', 'reason']);
    for (const key of ['transportationCost', 'utilityCost', 'monthlyInstallments', 'monthlyAid'])
        d[key] = profileHasValue(p[key]) ? p[key] : null;
    d.priority = choose('priority', f.priority);
    d.nextFollowUp = choose('nextFollowUp', f.nextFollowUp);
    d.liaisonName = null;
    d.supervisorName = null;
    d.sponsor = choose('sponsor', f.sponsor);
    d.archived = choose('archived', f.archived);
    d.notes = choose('notes', f.notes);
    d.notesHistory = choose('notesHistory', f.notesHistory);
    d.monthlyAidHistory = cleanProfileHistoryValue(p.monthlyAidHistory);
    d.caseItems = cleanProfileHistoryValue(p.caseItems);
    d.notesHistory = cleanProfileHistoryValue(p.notesHistory);
    delete d.documents;
    for (const key of ['housingType', 'housingDeposit', 'housingRent', 'address'])
        delete d[key];
    for (const key of Object.keys(d))
        if (profileIsTechnicalHistoryKey(key))
            delete d[key];
    const used = new Set(), group = keys => Object.fromEntries(keys.map(k => (used.add(k), [k, d[k] ?? null]))), groups = [['مشخصات خانواده و فرد اصلی خانوار', '۱', ['caseNumber', 'familySurname', 'headName', 'headRelation', 'headNationalId', 'headBirthDate', 'headPhone', 'familyPhone']], ['تحصیلات، شغل و درآمد', '۲', ['headEducation', 'headJob', 'incomeDescription']], ['بیمه و وضعیت درمانی', '۳', ['insurance', 'medical']], ['مسکن و وضعیت مالی', '۴', ['housing', 'debt', 'transportationCost', 'utilityCost', 'monthlyInstallments', 'monthlyAid']], ['اعضای خانواده', '۵', ['members']], ['حمایت و پیگیری', '۶', ['priority', 'nextFollowUp', 'liaisonName', 'supervisorName', 'sponsor', 'archived']], ['سوابق و یادداشت‌ها', '۷', ['monthlyAidHistory', 'caseItems', 'notesHistory', 'notes']]].map(([title, icon, keys]) => ({ title, icon, data: group(keys) }));
    const other = Object.fromEntries(Object.entries(d).filter(([k]) => !used.has(k)));
    if (Object.keys(other).length)
        groups.push({ title: 'سایر اطلاعات', 'icon': '+', data: other });
    return `<details id="comprehensiveSection" class="full-profile" aria-labelledby="fullProfileTitle" open><summary class="full-profile-hero" aria-controls="fullProfileBody"><span class="full-profile-intro"><span class="full-profile-mark" aria-hidden="true">▦</span><span class="full-profile-copy"><span class="full-profile-kicker">اطلاعات محدود به مدیر و رابط همان خانواده</span><strong id="fullProfileTitle">اطلاعات کامل خانواده</strong><span class="full-profile-subtitle">فیلدهای ثبت‌شده و قابل‌تکمیل در بخش‌های موضوعی پرونده</span></span></span><span class="full-profile-hero-actions"><span class="full-profile-access">دسترسی مجاز</span><span class="full-profile-toggle" aria-hidden="true"></span></span></summary><div class="full-profile-body" id="fullProfileBody"><div class="full-profile-overview"><div class="full-profile-stats"><div class="profile-stat"><span class="profile-stat-icon" aria-hidden="true">✓</span><span><small>موارد تکمیل‌شده</small><b data-profile-complete-count>—</b></span></div><div class="profile-stat"><span class="profile-stat-icon is-muted" aria-hidden="true">—</span><span><small>موارد باقی‌مانده</small><b data-profile-missing-count>—</b></span></div><div class="profile-stat"><span class="profile-stat-icon is-muted" aria-hidden="true">٪</span><span><small>تکمیل موارد پرونده</small><b id="profileCompletenessValue">—</b></span></div></div><label class="profile-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="fullProfileSearch" type="search" placeholder="جست‌وجو در اطلاعات خانواده…" aria-label="جست‌وجو در اطلاعات کامل خانواده"></label></div><div class="profile-sections">${groups.map((g, i) => renderProfileSection(g.title, g.icon, g.data, i === 0, { canWrite, familyId: f.id })).join('')}</div><div class="profile-no-results" id="profileNoResults" hidden>موردی با این عبارت پیدا نشد.</div><div id="comprehensiveContent" class="profile-integrated-content"><div class="panel-loading">در حال دریافت وضعیت پرونده…</div></div><p class="full-profile-footnote">فیلدهای خالی برای تکمیل نمایش داده می‌شوند؛ تعداد آن‌ها به‌تنهایی به‌معنای نقص فیلد اجباری نیست.</p></div></details>`;
}

function bindFullProfileSearch(root) { const input = root?.querySelector('#fullProfileSearch'); if (!input)
    return; const sections = [...root.querySelectorAll('[data-profile-section]')], empty = root.querySelector('#profileNoResults'); input.addEventListener('input', () => { const query = input.value.trim().toLocaleLowerCase('fa'); let matches = 0; sections.forEach(section => { let sectionMatches = 0; section.querySelectorAll('[data-profile-field]').forEach(field => { const match = !query || field.textContent.toLocaleLowerCase('fa').includes(query); field.hidden = !match; if (match)
    sectionMatches++; }); section.hidden = Boolean(query) && !sectionMatches; if (query && sectionMatches)
    section.open = true; matches += sectionMatches; }); if (empty)
    empty.hidden = !query || matches > 0; }); }

function bindFullProfileNationalIds(root) { root?.querySelectorAll('[data-profile-id-toggle]').forEach(button => { button.addEventListener('click', () => { const value = button.parentElement?.querySelector('[data-profile-id-value]'); if (!value)
    return; const shown = button.getAttribute('aria-pressed') === 'true'; value.textContent = shown ? value.dataset.masked : value.dataset.full; button.setAttribute('aria-pressed', String(!shown)); button.textContent = shown ? 'نمایش' : 'پنهان'; }); }); }

async function loadDetail(id) {
    selectedId = id;
    document.querySelectorAll('.family-item').forEach(x => x.classList.toggle('active', x.dataset.id === id));
    $('#familyDetail').innerHTML = '<div class="panel-loading"><div class="skeleton-stack" aria-label="در حال بارگذاری"><span></span><span></span><span></span><span></span></div></div>';
    try {
        const { family: f } = await api('/api/families/' + encodeURIComponent(id)), edu = f.headEducation?.description || f.headEducation?.level || 'ثبت نشده', canWrite = actor?.role === 'admin' || actor?.position === 'liaison' || actor?.position === 'supervision_deputy';
        $('#familyDetail').innerHTML = `<div class="family-contact-strip" id="familyContactStrip" aria-label="افراد مرتبط با خانواده"><div class="family-contact-item" data-contact="liaison"><span>رابط خیریه · کارکنان خیریه</span><b>در حال دریافت…</b></div><div class="family-contact-item" data-contact="supervisor"><span>سرپرست ارتباط خانواده‌ها</span><b>در حال دریافت…</b><small>پل ارتباطی خیریه با خانواده</small></div></div><div class="detail-head"><div><div class="eyebrow">فرد اصلی خانوار · پرونده ${esc(f.caseNumber)}</div><h2>${esc(f.headName)}</h2><span class="muted">خانوار ${esc(f.familySurname)}</span><div id="familyHeaderTags" class="family-tag-list family-header-tags" aria-label="برچسب‌های این خانواده"></div></div><div class="detail-actions"><span class="status">اولویت ${esc(f.priority)}</span>${actor?.isSuperAdmin ? '<button id="auditBtn" class="secondary" type="button">تاریخچه فعالیت</button>' : ''}${f.archived ? '<span class="archive-status">آرشیوشده</span>' : ''}${actor?.role === 'admin' && !f.archived ? '<button id="profileUploadBtn" class="secondary" type="button">بارگذاری اطلاعات کامل</button>' : ''}${canWrite && !f.profileRestricted && !f.archived ? '<button id="editFamilyBtn" class="secondary" type="button">ویرایش پرونده</button>' : ''}${canWrite ? `<button id="archiveFamilyBtn" class="${f.archived ? 'secondary' : 'danger'}" type="button">${f.archived ? 'بازگردانی پرونده' : 'آرشیو پرونده'}</button>` : ''}</div></div>${renderFamilyRenewalNotices(f)}${f.approvalStatus === 'pending' ? '<div class="archive-banner">این پرونده در انتظار تأیید سطح بالاتر است.</div>' : ''}${f.archived ? '<div class="archive-banner">این پرونده آرشیوشده است و تا زمان بازگردانی امکان ویرایش ندارد.</div>' : ''}<div class="detail-grid">${[['کد ملی فرد اصلی خانوار', f.headNationalId], ['شماره تماس', f.headPhone], ['کارت واریز ماهانه', f.headCardNumber ? '•••• •••• •••• ' + f.headCardNumber.slice(-4) : 'ثبت نشده'], ['تحصیلات', edu], ['شغل', f.headJob || 'ثبت نشده'], ['نوع مسکن', profileValueLabels[f.housingType] || f.housingType || 'ثبت نشده'], ['اجاره ماهانه', fa(f.housingRent) + ' تومان'], ['نشانی', f.address || 'نشانی ثبت نشده است.'], ['توضیحات', f.notes || 'توضیحات ثبت نشده است.']].map(x => `<div class="info-card ${x[0] === 'نشانی' || x[0] === 'توضیحات' ? 'info-card-wide' : ''}"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('')}</div><section id="familyIncomeSummary" class="family-income-summary"><div class="panel-loading">در حال محاسبه دریافتی ماهانه…</div></section><div class="detail-section"><div class="detail-section-title"><h3>اعضای خانوار</h3><span class="count-chip">${fa(f.members.length)} نفر</span></div><div class="member-grid">${f.members.map(m => `<article class="member-card"><div class="member-card-heading"><b>${esc(m.name)}</b><span class="member-relation">${esc(m.relation || 'نسبت ثبت نشده')}</span></div><div class="member-card-facts"><div class="member-fact"><span>شغل یا وضعیت</span><b>${esc(m.job || 'ثبت نشده')}</b></div><div class="member-fact"><span>حقوق ماهانه</span><b>${money(m.monthlyIncome || 0)} تومان</b></div><div class="member-fact member-fact-id"><span>کد ملی</span><div class="member-id-display"><b dir="ltr" data-member-national-id>${m.nationalId ? '•'.repeat(Math.max(0, String(m.nationalId).length - 4)) + esc(String(m.nationalId).slice(-4)) : 'ثبت نشده'}</b><button type="button" class="member-id-toggle" data-member-id-toggle aria-pressed="false" aria-label="نمایش کد ملی ${esc(m.name)}" title="نمایش کد ملی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></div></div></div></article>`).join('') || '<div class="member-card member-empty-state"><span class="member-empty-icon" aria-hidden="true">＋</span><div><b>هنوز عضوی ثبت نشده</b><p>اعضای این خانوار در این بخش نمایش داده می‌شوند.</p></div></div>'}</div></div><section id="supervisionSection" class="finance-section"><div class="panel-loading"><div>در حال دریافت گزارش‌های هفتگی…</div></div></section><section id="actionSection" class="finance-section"><div class="panel-loading"><div>در حال دریافت برنامه اقدامات…</div></div></section><section id="specialistSection" class="finance-section"><div class="panel-loading"><div>در حال دریافت پرونده‌های تخصصی…</div></div></section><section id="financeSection" class="finance-section"><div class="panel-loading"><div><div class="spinner"></div>در حال دریافت امور مالی…</div></div></section>${renderFullProfile(f, (actor?.role === 'admin' || actor?.position === 'liaison') && !f.archived)}`;
        if (f.profileRestricted) {
            $('#familyDetail .detail-grid')?.remove();
            $('#familyIncomeSummary')?.remove();
            $('#familyDetail .member-grid')?.closest('.detail-section')?.remove();
        }
        renderFamilyHeaderTags(f.tags || []);
        bindMemberNationalIdToggles($('#familyDetail'), f.members);
        bindFullProfileSearch($('#familyDetail'));
        bindFullProfileNationalIds($('#familyDetail'));
        window.dispatchEvent(new CustomEvent('familyloaded', { detail: { family: f } }));
        const auditBtn = $('#auditBtn');
        if (auditBtn)
            auditBtn.onclick = () => openAuditLog(f);
        const edit = $('#editFamilyBtn');
        if (edit)
            edit.onclick = () => openEditForm(f);
        const profileBtn = $('#profileUploadBtn');
        if (profileBtn)
            profileBtn.onclick = () => selectProfileJson(f);
        const archiveBtn = $('#archiveFamilyBtn');
        if (archiveBtn)
            archiveBtn.onclick = () => openArchiveDialog(f, !f.archived);
        mountCaseExtensions(f);
        bindProfileAttachmentActions($('#familyDetail'), f);
        loadProfileAttachments(f, (actor?.role === 'admin' || actor?.position === 'liaison') && !f.archived);
        refreshSectionCollapse();
        loadComprehensiveFamily(f);
        loadFamilyTeam(f);
        loadWeeklyReports(f);
        loadActionPlan(f);
        loadSpecialistCases(f);
        loadFinancialCases(f);
    }
    catch {
        $('#familyDetail').innerHTML = '<div class="empty-state">نمایش جزئیات ناموفق بود.</div>';
    }
    finally {
        const d = $('#familyDetail');
        if (d)
            d.scrollTop = 0;
    }
}

function bindMemberNationalIdToggles(root, members = []) { if (!root)
    return; const cards = [...root.querySelectorAll('.member-card:not(.member-empty-state)')]; cards.forEach((card, index) => { const raw = String(members[index]?.nationalId || '').trim(), value = card.querySelector('[data-member-national-id]'), button = card.querySelector('[data-member-id-toggle]'); if (!value || !button || !raw) {
    if (value)
        value.textContent = 'ثبت نشده';
    if (button)
        button.hidden = true;
    return;
} const masked = '•'.repeat(Math.max(0, raw.length - 4)) + raw.slice(-4); let shown = false; value.textContent = masked; button.onclick = () => { shown = !shown; value.textContent = shown ? raw : masked; button.setAttribute('aria-pressed', String(shown)); button.setAttribute('aria-label', `${shown ? 'پنهان‌کردن' : 'نمایش'} کد ملی ${members[index]?.name || 'عضو'}`); button.title = shown ? 'پنهان‌کردن کد ملی' : 'نمایش کد ملی'; }; }); }
