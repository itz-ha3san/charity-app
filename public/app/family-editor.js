/* Feature: family-editor. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
function dateDigits(value) { return String(value ?? '').replace(/[۰-۹٠-٩]/g, d => { const fa = '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); return String(fa >= 0 ? fa : '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }); }

function calendarDateToIso(value) { const raw = dateDigits(value).trim(), text = /^\d{4}-\d{2}-\d{2}T/.test(raw) ? raw.slice(0, 10) : raw.replace(/[/.]/g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text); if (!m)
    return ''; const [y, month, day] = m.slice(1).map(Number); if (y > 1700) {
    const d = new Date(Date.UTC(y, month - 1, day));
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === month && d.getUTCDate() === day ? `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
} if (y < 1200 || y > 1600 || month < 1 || month > 12 || day < 1 || day > 31)
    return ''; const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { calendar: 'persian', year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }), dayOfYear = month <= 6 ? (month - 1) * 31 + day - 1 : 186 + (month - 7) * 30 + day - 1, rough = Date.UTC(y + 621, 2, 19) + dayOfYear * 86400000; for (let i = -3; i <= 3; i++) {
    const date = new Date(rough + i * 86400000), parts = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
    if (+parts.year === y && +parts.month === month && +parts.day === day)
        return date.toISOString().slice(0, 10);
} return ''; }

function localTodayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function setFutureDateMin(form) { form?.querySelectorAll('input[type="date"][data-future-date]').forEach(input => input.min = localTodayIso()); }

function syncLeaseRenewalField(form) { const select = form?.elements?.namedItem('housingType'), input = form?.elements?.namedItem('housingLeaseRenewalDate'); if (!select || !input || input instanceof RadioNodeList)
    return; const rented = ['rent', 'rented', 'leased', 'tenant', 'استیجاری', 'اجاره‌ای', 'اجاره ای', 'مستأجرنشین'].includes(String(select.value || '').trim().toLowerCase()), field = input.closest('.form-field'); if (field) {
    field.hidden = !rented;
    field.classList.toggle('hidden', !rented);
} }

function bindLeaseRenewalField(form) { const select = form?.elements?.namedItem('housingType'); if (!select)
    return; select.addEventListener('change', () => syncLeaseRenewalField(form)); syncLeaseRenewalField(form); }

function setFutureDateField(form, name, value) { const input = form.elements.namedItem(name); if (!input || input instanceof RadioNodeList)
    return; const normalized = calendarDateToIso(value), today = localTodayIso(), original = normalized; input.value = normalized; if (original && original < today)
    input.removeAttribute('min');
else
    input.min = today; input.addEventListener('change', () => { if (original && input.value === original) {
    input.removeAttribute('min');
    input.setCustomValidity('');
    return;
} input.min = today; input.setCustomValidity(input.value && input.value < today ? 'تاریخ باید امروز یا در آینده باشد.' : ''); }); }

function formatCalendarDate(value) { const iso = calendarDateToIso(value); if (!iso)
    return ''; return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)); }

function daysUntilCalendarDate(value) { const iso = calendarDateToIso(value); if (!iso)
    return null; const [y, m, d] = iso.split('-').map(Number), [cy, cm, cd] = localTodayIso().split('-').map(Number); return Math.ceil((Date.UTC(y, m - 1, d) - Date.UTC(cy, cm - 1, cd)) / 86400000); }

function renderFamilyRenewalNotices(f) { const housingDate = f.housing?.leaseRenewalDate || f.housing?.renewalDate || f.profileData?.housing?.leaseRenewalDate || f.profileData?.housing?.renewalDate, rented = ['rent', 'rented', 'leased', 'tenant', 'استیجاری', 'اجاره‌ای', 'اجاره ای', 'مستأجرنشین'].includes(String(f.housingType || f.housing?.type || '').trim().toLowerCase()), items = [['insurance', 'بیمه', f.insurance?.renewalDate || f.profileData?.insurance?.renewalDate], ...(rented ? [['rent', 'اجاره مسکن', housingDate]] : [])].map(([type, label, date]) => ({ type, label, date, iso: calendarDateToIso(date), days: daysUntilCalendarDate(date) })).filter(x => x.iso && x.days !== null && x.days <= 30); if (!items.length)
    return ''; return `<div class="family-renewal-notices" role="status" aria-label="هشدار سررسید تمدید">${items.map(x => `<div class="family-renewal-notice ${x.days < 0 ? 'is-overdue' : x.days <= 7 ? 'is-urgent' : 'is-soon'}"><span class="renewal-notice-icon" aria-hidden="true">!</span><div><b>${x.days < 0 ? 'موعد تمدید ' + x.label + ' گذشته است' : 'موعد تمدید ' + x.label + ' نزدیک است'}</b><span>${x.days < 0 ? 'تاریخ ثبت‌شده: ' : x.days === 0 ? 'موعد: امروز · ' : `تا ${fa(x.days)} روز دیگر · `}${esc(formatCalendarDate(x.iso))}</span></div></div>`).join('')}</div>`; }

function familyAmount(value) { const digits = dateDigits(value).replace(/[^\d-]/g, ''); try {
    return BigInt(digits || '0');
}
catch {
    return 0n;
} }

function renderFamilyIncomeSummary(f, cases = [], paymentsLoaded = true) { const box = $('#familyIncomeSummary'); if (!box)
    return; const members = f.members || [], wageTotal = members.reduce((sum, m) => sum + familyAmount(m.monthlyIncome), 0n), monthlyAid = familyAmount(f.monthlyAid), month = localTodayIso().slice(0, 7), paidCurrentMonth = (cases || []).filter(x => x.status === 'پرداخت شده' && x.paymentId && String(x.paidAt || '').slice(0, 7) === month && familyAmount(x.paidAmount) > 0n), monthlyItems = paidCurrentMonth.filter(x => x.requestType === 'monthly'), adHocItems = paidCurrentMonth.filter(x => x.requestType !== 'monthly'), sumItems = items => items.reduce((sum, x) => sum + familyAmount(x.paidAmount), 0n), monthlyCaseTotal = sumItems(monthlyItems), adHocTotal = sumItems(adHocItems), total = wageTotal + monthlyAid + monthlyCaseTotal + adHocTotal, groupByCategory = items => { const out = new Map(); items.forEach(x => out.set(x.category || 'سایر', (out.get(x.category || 'سایر') || 0n) + familyAmount(x.paidAmount))); return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')); }, rows = [...members.filter(m => familyAmount(m.monthlyIncome) > 0n).map(m => [`حقوق ماهانه · ${m.name}`, familyAmount(m.monthlyIncome)]), ['کمک ثابت ماهانه ثبت‌شده', monthlyAid], ...groupByCategory(monthlyItems).map(([k, v]) => [`کمک ماهانه · ${k}`, v]), ...groupByCategory(adHocItems).map(([k, v]) => [`کمک موردی پرداخت‌شده · ${k}`, v])], details = rows.map(([label, amount]) => `<div class="income-breakdown-row"><span>${esc(label)}</span><b>${money(amount)} تومان</b></div>`).join(''); box.innerHTML = `<div class="family-income-main"><div><span class="eyebrow">برآورد دریافتی ماه جاری</span><h3>منابع مالی خانوار</h3><p>حقوق ثبت‌شده اعضا + کمک ثابت + پرداخت‌های مالی این ماه</p></div><div class="family-income-total"><strong>${money(total)}</strong><span>تومان در ماه</span></div></div><div class="family-income-chips"><span><small>حقوق اعضا</small><b>${money(wageTotal)} تومان</b></span><span><small>کمک ثابت</small><b>${money(monthlyAid)} تومان</b></span><span><small>پرداخت ماهانه</small><b>${money(monthlyCaseTotal)} تومان</b></span><span><small>کمک موردی این ماه</small><b>${money(adHocTotal)} تومان</b></span></div><details class="income-breakdown"><summary>جزئیات و تفکیک موضوعی</summary><div class="income-breakdown-body">${details || '<p class="muted">برای این ماه دریافتی ثبت‌شده‌ای وجود ندارد.</p>'}<div class="income-breakdown-row is-total"><span>جمع دریافتی برآوردی ماه</span><b>${money(total)} تومان</b></div><p>کمک‌های موردی و ماهانه فقط در صورت ثبت پرداخت در ماه جاری محاسبه شده‌اند.${paymentsLoaded ? '' : ' پرداخت‌های ماه جاری دریافت نشدند؛ جمع بالا موقت است.'}</p></div></details>`; }

function memberEditor(i) { return `<div class="member-editor" data-member><div class="member-editor-head"><b>عضو خانوار <span data-member-number>${fa(i + 1)}</span></b><button type="button" class="remove-member" data-remove-member>حذف عضو</button></div><div class="form-grid"><div class="form-field"><label>نام و نام خانوادگی <span class="required">*</span></label><input name="memberName" required minlength="2" maxlength="120"></div><div class="form-field"><label>نسبت</label><input name="memberRelation" placeholder="مثلاً فرزند"></div><div class="form-field"><label>کد ملی <span class="required">*</span></label><input name="memberNationalId" dir="ltr" inputmode="numeric" pattern="[0-9]{10}" required maxlength="10"></div><div class="form-field"><label>تاریخ تولد</label><input name="memberBirthDate" placeholder="۱۴۰۰/۰۱/۰۱"></div><div class="form-field"><label>شغل یا وضعیت</label><input maxlength="120" name="memberJob" placeholder="محصل، شاغل…"></div><div class="form-field"><label>تحصیلات</label><input maxlength="120" name="memberEducation" placeholder="پایه یا مقطع"></div><div class="form-field"><label>حقوق ماهانه (تومان)</label><input name="memberMonthlyIncome" inputmode="numeric" type="number" min="0" step="1000" value="0"></div></div></div>`; }

function bindMemberEditors() { document.querySelectorAll('[data-remove-member]').forEach(b => b.onclick = () => { b.closest('[data-member]').remove(); renumberMembers(); }); }

function renumberMembers() { document.querySelectorAll('[data-member-number]').forEach((x, i) => x.textContent = fa(i + 1)); }

function openCreateForm() { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal create-modal" role="dialog" aria-modal="true" aria-labelledby="createTitle"><div class="modal-head"><div><div class="eyebrow">ایجاد مستقیم در PostgreSQL</div><h2 id="createTitle">پرونده خانوار جدید</h2></div></div><form id="createFamilyForm"><section class="form-section"><h3>اطلاعات اصلی</h3><div class="form-grid"><div class="form-field"><label>شماره پرونده <span class="required">*</span></label><input name="caseNumber" required inputmode="numeric" maxlength="3" pattern="[1-9][0-9]{0,2}"><small class="form-help">شماره پرونده از ۱ تا ۹۹۹</small></div><div class="form-field"><label>نام خانوادگی <span class="required">*</span></label><input name="familySurname" required minlength="2" maxlength="120"></div><div class="form-field"><label>نام فرد اصلی خانوار <span class="required">*</span></label><input name="headName" required minlength="2" maxlength="120"></div><div class="form-field"><label>کد ملی فرد اصلی خانوار <span class="required">*</span></label><input name="headNationalId" dir="ltr" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></div><div class="form-field"><label>تاریخ تولد فرد اصلی خانوار</label><input name="headBirthDate" placeholder="۱۳۶۰/۰۱/۰۱"></div><div class="form-field"><label>شماره تماس فرد اصلی خانوار <span class="required">*</span></label><input name="headPhone" dir="ltr" inputmode="tel" minlength="11" maxlength="11" pattern="09[0-9]{9}" required></div><div class="form-field"><label>شماره کارت واریز ماهانه</label><input name="headCardNumber" dir="ltr" inputmode="numeric" maxlength="19" autocomplete="cc-number" placeholder="۱۶ رقم روی کارت"><small class="form-help" data-card-hint>برای واریز حمایت ماهانه به فرد اصلی خانوار</small></div><div class="form-field"><label>تلفن خانوار</label><input name="familyPhone" dir="ltr" inputmode="tel" maxlength="11" pattern="0[0-9]{10}"></div><div class="form-field"><label>شغل فرد اصلی خانوار</label><input maxlength="120" name="headJob"></div><div class="form-field"><label>تحصیلات فرد اصلی خانوار</label><input maxlength="120" name="headEducation"></div><div class="form-field"><label>اولویت</label><select name="priority"><option>متوسط</option><option>بالا</option><option>فوری</option><option>پایین</option></select></div><div class="form-field"><label>نوع بیمه</label><input name="insuranceType" placeholder="مثلاً بیمه سلامت"></div><div class="form-field"><label>هزینه ماهانه بیمه (تومان)</label><input name="insuranceCost" inputmode="numeric"></div><div class="form-field"><label>تاریخ تمدید بیمه</label><input name="insuranceRenewalDate" type="date" data-future-date><small class="form-help">تاریخ امروز یا آینده را انتخاب کنید.</small></div><div class="form-field"><label class="checkbox-field"><input type="checkbox" name="medicalHasCondition"><span>دارای بیماری خاص</span></label></div><div class="form-field full"><label>توضیح وضعیت درمانی</label><textarea name="medicalDescription"></textarea></div><div class="form-field"><label>هزینه ماهانه درمان (تومان)</label><input name="medicalMonthlyCost" inputmode="numeric"></div><div class="form-field full"><label>شرح درآمد</label><textarea name="incomeDescription"></textarea></div><div class="form-field"><label>مبلغ بدهی (تومان)</label><input name="debtAmount" inputmode="numeric"></div><div class="form-field"><label>علت بدهی</label><input name="debtReason" placeholder="مثلاً مسکن"></div><div class="form-field"><label>هزینه رفت‌وآمد (تومان)</label><input name="transportationCost" inputmode="numeric"></div><div class="form-field"><label>هزینه قبوض (تومان)</label><input name="utilityCost" inputmode="numeric"></div><div class="form-field"><label>اقساط ماهانه (تومان)</label><input name="monthlyInstallments" inputmode="numeric"></div><div class="form-field"><label>کمک ماهانه (تومان)</label><input name="monthlyAid" inputmode="numeric"></div><div class="form-field"><label>حامی</label><input name="sponsor"></div><div class="form-field"><label>پیگیری بعدی</label><input name="nextFollowUp" placeholder="۱۴۰۴/۰۵/۱۰"></div></div></section><section class="form-section"><h3>مسکن و نشانی</h3><div class="form-grid"><div class="form-field"><label>نوع مسکن</label><select name="housingType"><option value="other">سایر</option><option value="rent">استیجاری</option><option value="owned">ملکی</option><option value="relative">منزل بستگان</option></select></div><div class="form-field"><label>ودیعه (تومان)</label><input name="housingDeposit" type="number" min="0" value="0"></div><div class="form-field"><label>اجاره ماهانه (تومان)</label><input name="housingRent" type="number" min="0" value="0"></div><div class="form-field"><label>موعد تمدید اجاره</label><input name="housingLeaseRenewalDate" type="date" data-future-date><small class="form-help">برای هشدار پیش از سررسید</small></div><div class="form-field full"><label>نشانی</label><textarea name="address"></textarea></div></div></section><section class="form-section"><div class="detail-section-title"><div><h3>اعضای خانوار</h3><p class="form-help">اعضا را در صورت نیاز اضافه کنید.</p></div><button id="addMemberBtn" class="secondary" type="button">افزودن عضو</button></div><div id="memberEditors"></div></section><section class="form-section"><h3>یادداشت اولیه</h3><div class="form-grid"><div class="form-field full"><label>توضیحات پرونده</label><textarea name="notes"></textarea></div><div class="form-field full"><label>یادداشت پیگیری اولیه</label><textarea name="initialNote"></textarea></div><div class="form-field"><label>وضعیت یادداشت</label><input name="noteStatus" placeholder="مثلاً در حال پیگیری"></div><div class="form-field"><label>یادداشت مؤسسه</label><input name="institutionNote"></div></div></section><div id="createError" class="message error"></div><div class="modal-actions"><button id="submitFamily" class="primary" type="submit">ثبت پرونده جدید</button><button class="secondary" type="button" data-close>بازگشت</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#addMemberBtn').onclick = () => { const box = $('#memberEditors'), i = box.querySelectorAll('[data-member]').length; box.insertAdjacentHTML('beforeend', memberEditor(i)); bindMemberEditors(); }; $('#createFamilyForm').onsubmit = createFamily; setFutureDateMin($('#createFamilyForm')); bindLeaseRenewalField($('#createFamilyForm')); if (actor?.role === 'admin' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_deputy'].includes(actor?.position))
    mountSupervisorSelect($('#createFamilyForm'), editingFamilyCache?.supervisorId); }

/* ✔ اصلاح ۲: بازنویسی کامل collectFamilyPayload — حفظ زیرفیلدهای headEducation, insurance, member.education */
const familyToNumber = v => { const s = String(v ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d.-]/g, ''); return s ? Number(s) : 0; };

function collectFamilyPayload(form, includeInitial = true) {
    const fd = new FormData(form);
    const original = editingFamilyCache;
    const members = [...form.querySelectorAll('[data-member]')].map((row, index) => {
        const eduText = row.querySelector('[name=memberEducation]').value.trim();
        const origMember = original?.members?.[index];
        return {
            name: row.querySelector('[name=memberName]').value.trim(),
            relation: row.querySelector('[name=memberRelation]').value.trim(),
            nationalId: row.querySelector('[name=memberNationalId]').value.trim(),
            birthDate: row.querySelector('[name=memberBirthDate]').value.trim(),
            job: row.querySelector('[name=memberJob]').value.trim(),
            education: educationFromInput(origMember?.education, eduText),
            monthlyIncome: familyToNumber(row.querySelector('[name=memberMonthlyIncome]')?.value)
        };
    });
    const eduText = String(fd.get('headEducation') || '').trim();
    const headEducation = educationFromInput(original?.headEducation, eduText);
    const origInsurance = (original?.insurance && typeof original.insurance === 'object') ? original.insurance : {};
    const insurance = {
        ...origInsurance,
        type: String(fd.get('insuranceType') || '').trim(),
        cost: familyToNumber(fd.get('insuranceCost')),
        renewalDate: calendarDateToIso(fd.get('insuranceRenewalDate'))
    };
    const origMedical = original?.medical || original?.profileData?.medical || {};
    const medical = {
        ...origMedical,
        hasCondition: fd.get('medicalHasCondition') === 'on',
        description: String(fd.get('medicalDescription') || '').trim(),
        monthlyCost: familyToNumber(fd.get('medicalMonthlyCost'))
    };
    const body = {
        caseNumber: String(fd.get('caseNumber')).trim(),
        familySurname: String(fd.get('familySurname')).trim(),
        headName: String(fd.get('headName')).trim(),
        headNationalId: String(fd.get('headNationalId')).trim(),
        headBirthDate: String(fd.get('headBirthDate') || '').trim(),
        headPhone: String(fd.get('headPhone')).trim(),
        headCardNumber: String(fd.get('headCardNumber') || '').replace(/\D/g, ''),
        familyPhone: String(fd.get('familyPhone') || '').trim(),
        headEducation,
        headJob: String(fd.get('headJob') || '').trim(),
        insurance,
        medical,
        incomeDescription: String(fd.get('incomeDescription') || '').trim(),
        debt: { ...(original?.debt && typeof original.debt === 'object' && !Array.isArray(original.debt) ? original.debt : {}), amount: familyToNumber(fd.get('debtAmount')), reason: String(fd.get('debtReason') || '').trim() },
        transportationCost: familyToNumber(fd.get('transportationCost')),
        utilityCost: familyToNumber(fd.get('utilityCost')),
        monthlyInstallments: familyToNumber(fd.get('monthlyInstallments')),
        monthlyAid: familyToNumber(fd.get('monthlyAid')),
        sponsor: String(fd.get('sponsor') || '').trim(),
        nextFollowUp: String(fd.get('nextFollowUp') || '').trim(),
        supervisorId: fd.has('supervisorId') ? (String(fd.get('supervisorId') || '') || null) : undefined, housingType: String(fd.get('housingType')),
        housingDeposit: familyToNumber(fd.get('housingDeposit')),
        housingRent: familyToNumber(fd.get('housingRent')),
        housing: { ...(original?.housing && typeof original.housing === 'object' ? original.housing : {}), type: String(fd.get('housingType') || ''), deposit: familyToNumber(fd.get('housingDeposit')), rent: familyToNumber(fd.get('housingRent')), address: String(fd.get('address') || '').trim(), leaseRenewalDate: calendarDateToIso(fd.get('housingLeaseRenewalDate')) },
        address: String(fd.get('address') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        priority: String(fd.get('priority')),
        members
    };
    if (includeInitial) {
        const initial = String(fd.get('initialNote') || '').trim();
        body.notesHistory = initial ? [{ text: initial, status: String(fd.get('noteStatus') || ''), institutionNote: String(fd.get('institutionNote') || '') }] : [];
    }
    return body;
}

/* ✔ اصلاح ۳: پاک کردن کش هنگام ایجاد پرونده جدید */
async function createFamily(e) { e.preventDefault(); editingFamilyCache = null; const form = e.currentTarget; if (!form.reportValidity())
    return; const body = collectFamilyPayload(form), b = $('#submitFamily'); b.disabled = true; b.classList.add('button-loading'); try {
    const result = await api('/api/families', { method: 'POST', body: JSON.stringify(body) }), nextAction = window.CaseWizard?.success ? await window.CaseWizard.success({ mode: 'create', familyId: result.familyId }) : 'view';
    if (!window.CaseWizard?.success) {
        closeModal();
        toast('پرونده جدید با موفقیت ثبت شد.');
    }
    selectedId = result.familyId;
    await loadFamilies();
    if (nextAction === 'new') {
        editingFamilyCache = null;
        openCreateForm();
        return;
    }
    await loadDetail(result.familyId);
    if (nextAction === 'followup') {
        const { family } = await api('/api/families/' + encodeURIComponent(result.familyId));
        await openFamilyFollowupForm(family);
    }
    else if (nextAction === 'view')
        $('#familyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
catch (err) {
    b.disabled = false;
    b.classList.remove('button-loading');
    (() => { const box = $('#createError'), text = window.CaseWizard?.handleServerError?.(err) || err.data?.issues?.[0]?.message || err.message; if (box)
        box.textContent = text;
    else
        toast(text); })();
} }

function educationInputValue(value) { return typeof value === 'string' ? value : (value?.description || value?.level || ''); }

function educationFromInput(original, text) { if (String(text || '').trim() === String(educationInputValue(original) || '').trim())
    return original ?? {}; const base = original && typeof original === 'object' && !Array.isArray(original) ? original : {}; return { ...base, description: text, level: base.level || text }; }

function addPrefilledMember(m) { const box = $('#memberEditors'), i = box.querySelectorAll('[data-member]').length; box.insertAdjacentHTML('beforeend', memberEditor(i)); const row = box.lastElementChild; row.querySelector('[name=memberName]').value = m.name || ''; row.querySelector('[name=memberRelation]').value = m.relation || ''; row.querySelector('[name=memberNationalId]').value = m.nationalId || ''; row.querySelector('[name=memberBirthDate]').value = m.birthDate || ''; row.querySelector('[name=memberJob]').value = m.job || ''; row.querySelector('[name=memberEducation]').value = educationInputValue(m.education); row.querySelector('[name=memberMonthlyIncome]').value = m.monthlyIncome ?? 0; bindMemberEditors(); }

/* ✔ اصلاح ۴: کش کردن خانواده در openEditForm + محافظت RadioNodeList */
function openEditForm(f, focusField = null) {
    editingFamilyCache = f;
    openCreateForm();
    const modal = $('.create-modal'), backdrop = $('.modal-backdrop'), form = $('#createFamilyForm');
    modal.classList.add('edit-family-modal');
    backdrop.classList.add('edit-family-backdrop');
    const isLiaisonRequest = actor?.position === 'liaison';
    $('#createTitle').textContent = isLiaisonRequest ? 'درخواست اصلاح پرونده' : 'ویرایش پرونده خانوار';
    $('#submitFamily').textContent = isLiaisonRequest ? 'ارسال درخواست اصلاح' : 'ذخیره تغییرات';
    const head = modal.querySelector('.modal-head');
    head.classList.add('edit-family-header');
    head.innerHTML = `<div class="edit-family-header-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></div><div class="edit-family-header-copy"><div class="eyebrow">${isLiaisonRequest ? 'ثبت درخواست اصلاح' : 'ویرایش و تکمیل پرونده'}</div><h2 id="createTitle">${isLiaisonRequest ? 'درخواست اصلاح پرونده' : 'ویرایش پرونده خانوار'}</h2><p>${isLiaisonRequest ? 'تغییرات برای بررسی مدیر ارسال می‌شوند و پس از تأیید در پرونده اعمال خواهند شد.' : 'تغییرات را در بخش مربوط وارد کنید؛ اطلاعات دیگر بدون تغییر می‌مانند.'}</p><div class="edit-family-summary"><span>پرونده ${esc(f.caseNumber)}</span><span>${esc(f.familySurname || 'خانوار')}</span></div></div><button class="edit-family-close" type="button" aria-label="بستن ویرایش" title="بستن">×</button>`;
    const set = (n, v) => { const x = form.elements.namedItem(n); if (x && !(x instanceof RadioNodeList))
        x.value = v ?? ''; };
    set('caseNumber', f.caseNumber);
    set('familySurname', f.familySurname);
    set('headName', f.headName);
    set('headNationalId', f.headNationalId);
    set('headBirthDate', f.headBirthDate);
    set('headPhone', f.headPhone);
    set('headCardNumber', f.headCardNumber);
    set('familyPhone', f.familyPhone);
    set('headJob', f.headJob);
    set('headEducation', educationInputValue(f.headEducation));
    set('priority', f.priority);
    set('housingType', f.housingType || 'other');
    set('housingDeposit', f.housingDeposit ?? 0);
    set('housingRent', f.housingRent ?? 0);
    syncLeaseRenewalField(form);
    set('address', f.address);
    set('notes', f.notes);
    const insurance = f.insurance || {}, medical = f.medical || {}, debt = f.debt || {};
    set('insuranceType', insurance.type);
    set('insuranceCost', insurance.cost);
    setFutureDateField(form, 'insuranceRenewalDate', insurance.renewalDate);
    setFutureDateField(form, 'housingLeaseRenewalDate', f.housing?.leaseRenewalDate || f.housing?.renewalDate || f.profileData?.housing?.leaseRenewalDate || f.profileData?.housing?.renewalDate);
    const condition = form.elements.namedItem('medicalHasCondition');
    if (condition)
        condition.checked = medical.hasCondition === true;
    set('medicalDescription', medical.description);
    set('medicalMonthlyCost', medical.monthlyCost);
    set('incomeDescription', f.incomeDescription);
    set('debtAmount', debt.amount);
    set('debtReason', debt.reason);
    set('transportationCost', f.transportationCost);
    set('utilityCost', f.utilityCost);
    set('monthlyInstallments', f.monthlyInstallments);
    set('monthlyAid', f.monthlyAid);
    set('sponsor', f.sponsor);
    set('nextFollowUp', f.nextFollowUp);
    form.querySelectorAll('[name="initialNote"],[name="noteStatus"],[name="institutionNote"]').forEach(x => x.closest('.form-field')?.remove());
    const fieldMap = new Map([...form.querySelectorAll('.form-section .form-field')].map(field => [field.querySelector('[name]')?.name, field]).filter(([name]) => name));
    const used = new Set();
    const makeSection = (id, number, title, help, names, wide = []) => {
        const section = document.createElement('section');
        section.className = 'edit-form-section';
        section.id = 'edit-section-' + id;
        section.dataset.editSection = id;
        section.innerHTML = `<header class="edit-form-section-head"><span class="edit-form-step">${fa(number)}</span><div><h3>${title}</h3><p>${help}</p></div></header><div class="edit-form-grid"></div>`;
        const grid = section.querySelector('.edit-form-grid');
        names.forEach(name => { const field = fieldMap.get(name); if (!field)
            return; field.classList.remove('full'); field.classList.toggle('edit-field-wide', wide.includes(name)); grid.append(field); used.add(name); });
        return section;
    };
    const sections = [
        makeSection('identity', 1, 'مشخصات و راه‌های تماس', 'اطلاعات شناسایی و مسیر ارتباط با این خانوار.', ['caseNumber', 'familySurname', 'headName', 'headNationalId', 'headBirthDate', 'headPhone', 'familyPhone', 'headCardNumber', 'priority', 'supervisorId']),
        makeSection('work', 3, 'اشتغال و تحصیلات', 'وضعیت شغلی و تحصیلی فرد اصلی خانوار.', ['headJob', 'headEducation']),
        makeSection('health', 4, 'بیمه و سلامت', 'اطلاعات بیمه و نیازهای درمانی خانواده.', ['insuranceType', 'insuranceCost', 'insuranceRenewalDate', 'medicalHasCondition', 'medicalMonthlyCost', 'medicalDescription'], ['medicalDescription']),
        makeSection('housing', 5, 'مسکن و نشانی', 'نوع سکونت و هزینه‌های مرتبط با مسکن.', ['housingType', 'housingDeposit', 'housingRent', 'housingLeaseRenewalDate', 'address'], ['address']),
        makeSection('income', 6, 'درآمد و حمایت', 'درآمد، هزینه‌ها و برنامه حمایت و پیگیری.', ['incomeDescription', 'debtAmount', 'debtReason', 'transportationCost', 'utilityCost', 'monthlyInstallments', 'monthlyAid', 'sponsor', 'nextFollowUp'], ['incomeDescription'])
    ];
    used.add('notes');
    const extra = [...fieldMap].filter(([name]) => !used.has(name)).map(([, field]) => field);
    if (extra.length) {
        const extraSection = makeSection('other', 6, 'سایر اطلاعات', 'فیلدهای تکمیلی پرونده.', [], []);
        extra.forEach(field => extraSection.querySelector('.edit-form-grid').append(field));
        sections.push(extraSection);
    }
    const membersBox = form.querySelector('#memberEditors'), addMember = form.querySelector('#addMemberBtn'), membersSection = document.createElement('section');
    membersSection.className = 'edit-form-section edit-members-section';
    membersSection.id = 'edit-section-members';
    membersSection.dataset.editSection = 'members';
    membersSection.innerHTML = `<header class="edit-form-section-head"><span class="edit-form-step">${fa(2)}</span><div><h3>اعضای خانوار</h3><p>اطلاعات هر عضو را جداگانه ویرایش یا عضو تازه اضافه کنید.</p></div><span class="edit-member-count" data-edit-member-count></span></header>`;
    membersSection.querySelector('.edit-form-section-head').append(addMember);
    membersSection.append(membersBox);
    sections.splice(1, 0, membersSection);
    const notesField = fieldMap.get('notes'), notesSection = document.createElement('section');
    notesSection.className = 'edit-form-section';
    notesSection.id = 'edit-section-notes';
    notesSection.dataset.editSection = 'notes';
    notesSection.innerHTML = `<header class="edit-form-section-head"><span class="edit-form-step">${fa(7)}</span><div><h3>یادداشت پرونده</h3><p>یادداشت عمومی پرونده؛ سوابق پیگیری جداگانه ثبت می‌شوند.</p></div></header><div class="edit-form-grid"></div>`;
    if (notesField) {
        notesField.classList.remove('full');
        notesField.classList.add('edit-field-wide');
        notesSection.querySelector('.edit-form-grid').append(notesField);
    }
    sections.push(notesSection);
    form.querySelectorAll(':scope > .form-section').forEach(section => section.remove());
    const nav = document.createElement('nav');
    nav.className = 'edit-form-nav';
    nav.setAttribute('aria-label', 'رفتن به بخش‌های ویرایش');
    const navItems = [['identity', 'مشخصات'], ['members', 'اعضا'], ['work', 'اشتغال و تحصیل'], ['health', 'بیمه و سلامت'], ['housing', 'مسکن و اجاره'], ['income', 'درآمد و حمایت'], ['notes', 'یادداشت']].filter(([id]) => sections.some(section => section.dataset.editSection === id));
    nav.innerHTML = navItems.map(([id, label], index) => `<button type="button" data-edit-jump="edit-section-${id}" aria-current="${index === 0 ? 'location' : 'false'}"><span>${fa(index + 1)}</span>${label}</button>`).join('');
    const body = document.createElement('div');
    body.className = 'edit-form-body';
    sections.forEach(section => body.append(section));
    const oldError = form.querySelector('#createError'), oldActions = form.querySelector('.modal-actions'), footer = document.createElement('footer');
    footer.className = 'edit-form-footer';
    footer.innerHTML = '<div class="edit-form-footer-note">' + (isLiaisonRequest ? 'تغییرات پس از بررسی و تأیید مدیر در پرونده اعمال می‌شوند.' : 'تغییرات فقط پس از فشردن «ذخیره تغییرات» ثبت می‌شوند.') + '</div>';
    if (oldError) {
        oldError.setAttribute('aria-live', 'polite');
        footer.append(oldError);
    }
    if (oldActions) {
        oldActions.classList.add('edit-form-actions');
        const cancel = oldActions.querySelector('[data-close]');
        if (cancel)
            cancel.textContent = 'انصراف';
        footer.append(oldActions);
    }
    form.classList.add('edit-family-form');
    form.dataset.dirty = 'false';
    form.dataset.changedFields = '[]';
    form.append(nav, body, footer);
    const updateMemberCount = () => { const count = membersBox.querySelectorAll('[data-member]').length, badge = membersSection.querySelector('[data-edit-member-count]'); if (badge)
        badge.textContent = fa(count) + ' عضو'; };
    const changedRoots = new Set(), fieldRootMap = { caseNumber: 'caseNumber', familySurname: 'familySurname', headName: 'headName', headNationalId: 'headNationalId', headBirthDate: 'headBirthDate', headPhone: 'headPhone', headCardNumber: 'headCardNumber', familyPhone: 'familyPhone', headEducation: 'headEducation', headJob: 'headJob', priority: 'priority', insuranceType: 'insurance', insuranceCost: 'insurance', insuranceRenewalDate: 'insurance', medicalHasCondition: 'medical', medicalDescription: 'medical', medicalMonthlyCost: 'medical', incomeDescription: 'incomeDescription', debtAmount: 'debt', debtReason: 'debt', transportationCost: 'transportationCost', utilityCost: 'utilityCost', monthlyInstallments: 'monthlyInstallments', monthlyAid: 'monthlyAid', sponsor: 'sponsor', nextFollowUp: 'nextFollowUp', supervisorId: 'supervisorId', housingType: ['housingType', 'housing'], housingDeposit: ['housingDeposit', 'housing'], housingRent: ['housingRent', 'housing'], housingLeaseRenewalDate: 'housing', address: ['address', 'housing'], notes: 'notes', memberName: 'members', memberRelation: 'members', memberNationalId: 'members', memberBirthDate: 'members', memberJob: 'members', memberEducation: 'members', memberMonthlyIncome: 'members' };
    const markChanged = (event) => { form.dataset.dirty = 'true'; const roots = fieldRootMap[event?.target?.name] || []; (Array.isArray(roots) ? roots : [roots]).filter(Boolean).forEach(key => changedRoots.add(key)); form.dataset.changedFields = JSON.stringify([...changedRoots]); };
    updateMemberCount();
    form.addEventListener('click', e => { if (e.target.closest('#addMemberBtn,[data-remove-member]')) {
        markChanged({ target: { name: 'memberName' } });
        requestAnimationFrame(updateMemberCount);
    } });
    form.addEventListener('input', markChanged);
    form.addEventListener('change', markChanged);
    const safeClose = () => { if (form.dataset.dirty === 'true') {
        openUnsavedEditDialog(closeModal);
        return;
    } closeModal(); };
    modal.querySelector('.edit-family-close').onclick = safeClose;
    const cancelEdit = footer.querySelector('[data-close]');
    if (cancelEdit)
        cancelEdit.onclick = e => { e.preventDefault(); safeClose(); };
    nav.querySelectorAll('[data-edit-jump]').forEach(button => button.onclick = () => { const target = $('#' + button.dataset.editJump); target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); nav.querySelectorAll('button').forEach(item => item.setAttribute('aria-current', String(item === button ? 'location' : 'false'))); });
    form.onsubmit = e => updateFamily(e, f.id);
    (f.members || []).forEach(addPrefilledMember);
    updateMemberCount();
    const selectors = { caseNumber: '[name="caseNumber"]', familySurname: '[name="familySurname"]', headName: '[name="headName"]', headNationalId: '[name="headNationalId"]', headPhone: '[name="headPhone"]', headBirthDate: '[name="headBirthDate"]', headJob: '[name="headJob"]', headEducation: '[name="headEducation"]', familyPhone: '[name="familyPhone"]', address: '[name="address"]', housingCost: '[name="housingDeposit"]', members: '[name="memberName"]', notes: '[name="notes"]', headCardNumber: '[name="headCardNumber"]', housingType: '[name="housingType"]', housingRent: '[name="housingRent"]', housingLeaseRenewalDate: '[name="housingLeaseRenewalDate"]', insurance: '[name="insuranceType"]', medical: '[name="medicalHasCondition"]', incomeDescription: '[name="incomeDescription"]', debt: '[name="debtAmount"]', transportationCost: '[name="transportationCost"]', utilityCost: '[name="utilityCost"]', monthlyInstallments: '[name="monthlyInstallments"]', monthlyAid: '[name="monthlyAid"]', sponsor: '[name="sponsor"]', nextFollowUp: '[name="nextFollowUp"]', supervisorId: '[name="supervisorId"]' };
    if (focusField) {
        requestAnimationFrame(() => requestAnimationFrame(() => { if (focusField === 'members' && !(f.members || []).length)
            $('#addMemberBtn')?.click(); const target = form.querySelector(selectors[focusField] || ''); if (target) {
            target.focus({ preventScroll: true });
            const section = target.closest('.edit-form-section');
            section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nav.querySelectorAll('button').forEach(item => item.setAttribute('aria-current', String(item.dataset.editJump === section?.id ? 'location' : 'false')));
            target.closest('.form-field')?.classList.add('guided-field');
            setTimeout(() => target.closest('.form-field')?.classList.remove('guided-field'), 1800);
        } }));
    }
}

/* ✔ اصلاح ۵: پاک کردن کش پس از موفقیت در updateFamily */
function openUnsavedEditDialog(onDiscard) {
    const returnFocus = document.activeElement, layer = document.createElement('div');
    layer.className = 'modal-backdrop unsaved-changes-backdrop';
    layer.innerHTML = `<section class="modal unsaved-changes-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsavedChangesTitle" aria-describedby="unsavedChangesCopy"><header class="unsaved-changes-head"><span class="unsaved-changes-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 2.8 19a1.6 1.6 0 0 0 1.4 2.4h15.6a1.6 1.6 0 0 0 1.4-2.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg></span><button class="close-btn" type="button" data-continue aria-label="بازگشت به ویرایش">×</button></header><div class="unsaved-changes-copy"><span class="eyebrow">پیش از خروج</span><h2 id="unsavedChangesTitle">تغییرات ذخیره نشده‌اند</h2><p id="unsavedChangesCopy">اطلاعاتی که در این فرم تغییر داده‌اید هنوز ثبت نشده است. اگر خارج شوید، تغییرات از دست می‌روند.</p></div><div class="unsaved-changes-status"><span aria-hidden="true">•</span> پرونده هنوز ذخیره نشده</div><footer class="unsaved-changes-actions"><button class="secondary" type="button" data-continue>بازگشت به ویرایش</button><button class="danger" type="button" data-discard>خروج بدون ذخیره</button></footer></section>`;
    document.body.append(layer);
    let done = false;
    const finish = discard => { if (done)
        return; done = true; document.removeEventListener('keydown', onKey); layer.remove(); if (discard)
        onDiscard?.();
    else
        returnFocus?.focus?.({ preventScroll: true }); };
    const onKey = e => { if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
    } if (e.key === 'Tab') {
        const buttons = [...layer.querySelectorAll('button:not([disabled])')], first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } };
    document.addEventListener('keydown', onKey);
    layer.querySelectorAll('[data-continue]').forEach(button => button.addEventListener('click', () => finish(false)));
    layer.querySelector('[data-discard]').addEventListener('click', () => finish(true));
    layer.addEventListener('click', e => { if (e.target === layer)
        finish(false); });
    layer.querySelector('[data-continue]').focus();
}

function showFamilyChangeRequestNotice(result) {
    const requestId = result?.changeRequestId || '';
    AppUI.mountModal(`<div class="modal-backdrop"><section class="modal family-change-notice" role="dialog" aria-modal="true" aria-labelledby="familyChangeNoticeTitle"><div class="family-change-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v4l2.5 1.5"/><circle cx="12" cy="12" r="9"/><path d="M7 2.8 5.5 4.5M17 2.8l1.5 1.7"/></svg></div><span class="eyebrow">در انتظار بررسی مدیر</span><h2 id="familyChangeNoticeTitle">درخواست اصلاح پرونده ارسال شد</h2><p>این حساب اجازهٔ ثبت مستقیم تغییرات را ندارد. درخواست شما برای بررسی فرستاده شد؛ تا زمان تأیید، اطلاعات قبلی پرونده نمایش داده می‌شود.</p>${requestId ? `<div class="family-change-request-id"><span>شمارهٔ پیگیری درخواست</span><b dir="ltr">${esc(requestId)}</b></div>` : ''}<div class="family-change-notice-actions"><button class="primary" type="button" id="closeFamilyChangeNotice">متوجه شدم</button></div></section></div>`);
    $('#closeFamilyChangeNotice').onclick = closeModal;
}

async function updateFamily(e, id) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity())
        return;
    const proposedData = collectFamilyPayload(form, false), button = $('#submitFamily'), isLiaisonRequest = actor?.position === 'liaison';
    let body = proposedData;
    if (isLiaisonRequest) {
        let changedFields = [];
        try {
            changedFields = JSON.parse(form.dataset.changedFields || '[]');
        }
        catch { }
        if (!changedFields.length) {
            $('#createError').textContent = 'هیچ فیلدی برای تغییر انتخاب نشده است.';
            return;
        }
        body = { changedFields, proposedData };
    }
    button.disabled = true;
    button.classList.add('button-loading');
    try {
        const result = await api('/api/families/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) });
        if (result?.status === 'pending') {
            editingFamilyCache = null;
            selectedId = id;
            closeModal();
            await loadDetail(id);
            showFamilyChangeRequestNotice(result);
            return;
        }
        const nextAction = window.CaseWizard?.success ? await window.CaseWizard.success({ mode: 'edit', familyId: id }) : 'view';
        if (!window.CaseWizard?.success) {
            closeModal();
            toast('تغییرات پرونده با موفقیت ذخیره شد.');
        }
        editingFamilyCache = null;
        selectedId = id;
        await loadFamilies();
        await loadDetail(id);
        if (nextAction === 'followup') {
            const { family } = await api('/api/families/' + encodeURIComponent(id));
            await openFamilyFollowupForm(family);
        }
        else if (nextAction === 'view')
            $('#familyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    catch (err) {
        button.disabled = false;
        button.classList.remove('button-loading');
        const box = $('#createError'), text = window.CaseWizard?.handleServerError?.(err) || err.data?.issues?.[0]?.message || err.message;
        if (box)
            box.textContent = text;
        else
            toast(text);
    }
}

function revealFamilyDetailSection(id, focusSelector) { const section = $('#' + id); if (!section)
    return; const toggle = section.previousElementSibling; if (toggle?.classList.contains('simple-section-toggle') && section.hidden)
    toggle.click();
else
    section.hidden = false; section.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (focusSelector) {
    let tries = 0;
    const timer = setInterval(() => { const target = section.querySelector(focusSelector); if (target || tries++ > 30) {
        clearInterval(timer);
        target?.focus({ preventScroll: true });
    } }, 120);
} }

function openFamilyMissingField({ family, fieldKey } = {}) { if (!family || !fieldKey)
    return; if (fieldKey === 'supervisor') {
    if (actor?.position === 'liaison') {
        toast('تعیین سرپرست ارتباط خانواده در اختیار معاونان است.');
        return;
    }
    document.querySelector('#assignSupervisorBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('#assignSupervisorBtn')?.click();
    return;
} if (fieldKey === 'supervisionPlan') {
    revealFamilyDetailSection('supervisionSection', '#newWeeklyReportBtn');
    return;
} openEditForm(family, fieldKey); }

function selectProfileJson(current) { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = async () => { try {
    const raw = JSON.parse(await input.files[0].text()), families = Array.isArray(raw?.families) ? raw.families : [raw], match = families.find(x => String(x.caseNumber) === String(current.caseNumber));
    if (!match)
        throw Error('در فایل، پرونده‌ای با همین شماره پیدا نشد.');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">تکمیل پرونده موجود</div><h2>اطلاعات کامل پرونده ${esc(current.caseNumber)}</h2></div><button class="close-btn" data-close>×</button></div><p>تمام فیلدهای JSON ذخیره و فقط به مدیر نمایش داده می‌شود.</p><div id="profileError" class="message error"></div><div class="modal-actions"><button id="confirmProfile" class="primary">تأیید و ذخیره</button><button class="secondary" data-close>انصراف</button></div></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    $('#confirmProfile').onclick = async () => { try {
        await api('/api/families/' + encodeURIComponent(current.id) + '/profile', { method: 'PUT', body: JSON.stringify(match) });
        closeModal();
        toast('اطلاعات کامل پرونده ذخیره شد.');
        await loadDetail(current.id);
    }
    catch (e) {
        $('#profileError').textContent = e.data?.error === 'PROFILE_CASE_MISMATCH' ? 'شماره پرونده فایل یکسان نیست.' : e.message;
    } };
}
catch (e) {
    toast(e.message);
} }; input.click(); }
