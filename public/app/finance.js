/* Feature: finance. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const financeStatuses = ['درخواست جدید', 'در بررسی', 'تأیید شده', 'ارجاع به حسابدار', 'پرداخت شده', 'رد شده', 'لغو شده'], sourceTypeNames = { direct: 'ثبت مستقیم', weekly_report: 'گزارش هفتگی', action: 'اقدام', health_case: 'پرونده درمان', education_case: 'پرونده آموزش' };

const elevatedFinancial = () => actor?.role === 'admin' || ['ceo', 'education_deputy', 'health_deputy', 'supervision_deputy'].includes(actor?.position);

const canFinancialDecision = x => actor?.role === 'admin' || actor?.position === 'ceo' || actor?.position === x.requiredApproverPosition;

function financeStatusClass(s) { return s === 'پرداخت شده' ? 'paid' : s === 'رد شده' ? 'rejected' : s === 'ارجاع به حسابدار' ? 'referred' : s === 'تأیید شده' ? 'approved' : ''; }

function financeActions(x) { const a = []; if (['admin', 'caseworker'].includes(actor?.role) && ['درخواست جدید', 'در بررسی'].includes(x.status))
    a.push(`<button class="secondary" data-edit-finance="${x.id}">ویرایش</button>`); if (x.status === 'درخواست جدید' && (actor?.position === 'liaison' || actor?.id === x.createdBy || elevatedFinancial()))
    a.push(`<button class="secondary" data-action="review" data-id="${x.id}">ارسال برای بررسی</button>`); if (x.status === 'در بررسی' && canFinancialDecision(x)) {
    a.push(`<button class="primary" data-action="approve" data-id="${x.id}">تأیید مبلغ</button>`);
    a.push(`<button class="danger" data-action="reject" data-id="${x.id}">رد</button>`);
} if (x.status === 'تأیید شده' && canFinancialDecision(x))
    a.push(`<button class="primary" data-action="queue_payment" data-id="${x.id}">ارجاع به مالی</button>`); if (x.status === 'ارجاع به حسابدار' && ['admin', 'accountant'].includes(actor?.role))
    a.push(`<button class="primary" data-pay="${x.id}">ثبت پرداخت</button>`); if (!['پرداخت شده', 'رد شده', 'لغو شده'].includes(x.status) && canFinancialDecision(x))
    a.push(`<button class="danger" data-action="cancel" data-id="${x.id}">لغو</button>`); if (!['پرداخت شده', 'رد شده', 'لغو شده'].includes(x.status))
    a.push(`<button class="secondary" data-fin-doc="${x.id}">پیوست مالی</button>`); return a.length ? `<div class="workflow-actions">${a.join('')}</div>` : ''; }

async function loadActiveFamilyChoices() {
    const families = [];
    for (let offset = 0;; offset += 100) {
        const page = await api('/api/families?' + new URLSearchParams({ status: 'active', limit: '100', offset: String(offset) }));
        families.push(...(page.families || []));
        if (families.length >= Number(page.total || 0) || !(page.families || []).length)
            break;
    }
    return families;
}

function openQuickOccasionalForm() { return openFinancialForm(null, null); }

async function openQuickFollowupForm() {
    // This top-level action must always ask which family the report belongs to.
    // The in-family action calls openFamilyFollowupForm(family) directly and stays preselected.
    return openFamilyFollowupForm(null);
}

async function loadFinancialCases(f) { const box = $('#financeSection'); if (!box)
    return; try {
    const d = await api('/api/families/' + f.id + '/financial-cases'), can = ['admin', 'caseworker'].includes(actor?.role) && !f.archived;
    renderFamilyIncomeSummary(f, d.financialCases || [], true);
    box.innerHTML = `<div class="finance-head"><div><div class="eyebrow">گردش تأیید و پرداخت</div><h3>امور مالی</h3></div>${can ? '<button id="newFinanceBtn" class="primary">ثبت درخواست مالی</button>' : ''}</div><div class="finance-summary"><span class="count-chip">${fa(d.financialCases.length)} درخواست</span><span class="count-chip">درخواست‌شده: ${money(d.totalAmount)} تومان</span><span class="count-chip">پرداخت‌شده: ${money(d.paidAmount)} تومان</span></div><div class="finance-list">${d.financialCases.map(x => `<article class="finance-card"><div class="finance-card-head"><div><h4>${esc(x.title)}</h4><div class="finance-meta">${esc(x.category)} · منبع: ${esc(sourceTypeNames[x.sourceType] || x.sourceType)}</div></div><span class="finance-status ${financeStatusClass(x.status)}">${esc(x.status)}</span></div><div class="finance-amount">درخواستی: ${money(x.amount)} تومان${x.approvedAmount ? ` · تأییدشده: ${money(x.approvedAmount)} تومان` : ''}</div>${x.decisionNote ? `<p class="finance-note"><b>نظر بررسی:</b> ${esc(x.decisionNote)}</p>` : ''}${x.description ? `<p class="finance-note">${esc(x.description)}</p>` : ''}${x.rejectionReason ? `<p class="finance-note"><b>دلیل رد:</b> ${esc(x.rejectionReason)}</p>` : ''}<div class="case-attachments"><div class="case-attachments-title"><strong>مدارک این درخواست</strong><span>${fa((x.documents || []).length)} پیوست</span></div>${(x.documents || []).map(doc => `<div class="case-attachment-row"><span>▤</span><div><b>${esc(doc.fileName)}</b><small>${esc(doc.documentType)}${doc.description ? ' · ' + esc(doc.description) : ''}</small></div><button type="button" class="secondary" data-secure-download="/api/financial-documents/${esc(doc.id)}/download">دریافت</button></div>`).join('') || '<p class="case-attachments-empty">مدرکی به این درخواست وصل نشده است.</p>'}</div>${x.paymentId ? `<div class="finance-meta">صندوق: ${esc(x.fundName)} · پرداخت: ${esc(x.paidAt)} · پیگیری: ${esc(x.referenceNo)}</div>${x.receiptFileName ? `<button class="receipt-link" data-secure-download="/api/payments/${x.paymentId}/receipt">دریافت رسید</button>` : ''}` : ''}${financeActions(x)}</article>`).join('') || '<div class="empty-state">درخواستی ثبت نشده است.</div>'}</div><div class="detail-section"><h4>تاریخچه موارد خانواده</h4>${(d.history || []).map(e => `<div class="note-card"><b>${esc(e.actorName || 'سیستم')} · ${esc(e.action)}</b><p>${esc(e.fromStatus || '')} ← ${esc(e.toStatus || '')} ${e.amount ? '· ' + money(e.amount) + ' تومان' : ''}</p>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div>`).join('') || '<div class="muted">هنوز رویدادی ثبت نشده است.</div>'}</div>`;
    $('#newFinanceBtn') && ($('#newFinanceBtn').onclick = () => openFinancialForm(f, null));
    box.querySelectorAll('[data-edit-finance]').forEach(b => { const x = d.financialCases.find(i => i.id === b.dataset.editFinance); b.onclick = () => openFinancialForm(f, x); });
    box.querySelectorAll('[data-action]').forEach(b => b.onclick = () => transitionFinancial(f, b.dataset.id, b.dataset.action));
    box.querySelectorAll('[data-fin-doc]').forEach(b => b.onclick = () => uploadFinancialDocument(f, b.dataset.finDoc));
    box.querySelectorAll('[data-pay]').forEach(b => { const x = d.financialCases.find(i => i.id === b.dataset.pay); b.onclick = () => openPaymentForm(f, x); });
}
catch (e) {
    renderFamilyIncomeSummary(f, [], false);
    box.innerHTML = `<div class="empty-state">خطا در دریافت امور مالی: ${esc(e.message)}</div>`;
} }

async function openFinancialForm(f, item) {
    const edit = Boolean(item), categories = ['لوازم آموزشی', 'بهداشت و درمان', 'بیمه', 'کلاس آموزشی', 'خرید لوازم منزل', 'معیشت', 'قسط', 'اهدایی', 'مسکن', 'درمان', 'تحصیل', 'خوراک', 'اشتغال', 'کمک نقدی', 'سایر'];
    if (item?.category && !categories.includes(item.category))
        categories.unshift(item.category);
    let families = [];
    if (!f && !edit) {
        try {
            families = await loadActiveFamilyChoices();
        }
        catch (e) {
            toast(e.message);
            return;
        }
        if (!families.length)
            return toast('پروندهٔ فعالی برای ثبت درخواست پیدا نشد.');
    }
    const familyOptions = families.map(x => `<option value="${esc(x.id)}" data-family-name="${esc(x.headName || x.familySurname || 'خانواده')}" data-case-number="${esc(x.caseNumber || '—')}">${esc(x.headName || '')} · ${esc(x.familySurname || '')} · پرونده ${esc(x.caseNumber || '—')}</option>`).join('');
    const selectedType = item?.requestType || 'ad_hoc', headName = String(f?.headName || '').trim(), surname = String(f?.familySurname || '').trim(), familyName = headName && surname && !headName.includes(surname) ? headName + ' ' + surname : headName || surname || 'خانواده';
    const familyPicker = f ? `<div class="financial-family-context"><span class="financial-context-icon" aria-hidden="true">▤</span><span class="financial-context-copy"><small>پرونده مربوط به</small><strong>${esc(familyName)}</strong></span><span class="financial-case-number">پرونده ${esc(f.caseNumber || '—')}</span></div>` : `<section class="financial-form-section financial-family-picker"><div class="financial-section-heading"><span class="financial-section-index">۱</span><div><h3>انتخاب خانواده</h3><p>درخواست مالی به پروندهٔ خانوادهٔ انتخاب‌شده پیوند می‌خورد.</p></div></div><div class="financial-form-grid"><div class="form-field full"><label for="financialFamilySearch">جست‌وجوی خانواده</label><input id="financialFamilySearch" type="search" placeholder="نام یا شماره پرونده"></div><div class="form-field full"><label for="financialFamilySelect">خانوادهٔ مرتبط <span class="required">*</span></label><select id="financialFamilySelect" name="familyId" required><option value="">انتخاب خانواده</option>${familyOptions}</select></div><div id="financialFamilySummary" class="quick-family-summary full">برای ادامه، خانوادهٔ مرتبط را انتخاب کنید.</div></div></section>`;
    const stepOffset = f ? 0 : 1;
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal financial-modal quick-occasional-modal" role="dialog" aria-modal="true" aria-labelledby="financialFormTitle"><header class="financial-modal-head"><div><div class="eyebrow">${edit ? 'به‌روزرسانی مورد مالی' : 'ثبت درخواست برای خانواده'}</div><h2 id="financialFormTitle">${edit ? 'ویرایش مورد مالی' : 'ثبت درخواست مالی'}</h2><p>${f ? 'جزئیات درخواست را وارد کنید تا برای بررسی و پیگیری در همین پرونده ثبت شود.' : 'خانواده را انتخاب کنید و جزئیات درخواست مالی را وارد کنید.'}</p></div><button class="close-btn" type="button" data-close aria-label="بستن پنجره">×</button></header>${f ? familyPicker : ''}
  <form id="financialForm" class="financial-form">${f ? '' : familyPicker}<section class="financial-form-section"><div class="financial-section-heading"><span class="financial-section-index">${fa(1 + stepOffset)}</span><div><h3>جزئیات درخواست</h3><p>عنوان، دسته و نوع حمایت را مشخص کنید.</p></div></div><div class="financial-form-grid"><div class="form-field full"><label for="financialTitle">عنوان درخواست <span class="required">*</span></label><input id="financialTitle" name="title" required minlength="2" maxlength="180" placeholder="مثلاً تهیه لوازم ضروری مدرسه" value="${esc(item?.title || '')}"></div>
  <div class="form-field"><label for="financialCategory">دسته‌بندی <span class="required">*</span></label><select id="financialCategory" name="category" required>${categories.map(x => `<option value="${esc(x)}" ${item?.category === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
  <div class="form-field"><label for="financialRequestType">دوره درخواست</label><select id="financialRequestType" name="requestType"><option value="ad_hoc" ${selectedType === 'ad_hoc' ? 'selected' : ''}>موردی</option><option value="monthly" ${selectedType === 'monthly' ? 'selected' : ''}>ماهانه</option></select><small class="financial-field-help">درخواست موردی یک‌بار ثبت می‌شود؛ درخواست ماهانه برای حمایت‌های تکرارشونده است.</small></div>
  <div class="form-field full financial-amount-field"><label for="financialAmount">مبلغ درخواستی (تومان) <span class="required">*</span></label><div class="financial-amount-control"><input id="financialAmount" class="money-input" name="amount" type="number" min="1" step="1" inputmode="numeric" required placeholder="مبلغ را وارد کنید" value="${esc(item?.amount || '')}"></div><small class="financial-field-help">مبلغ نهایی پس از بررسی قابل تأیید یا اصلاح است.</small></div></div></section>
  <section class="financial-form-section"><div class="financial-section-heading"><span class="financial-section-index">${fa(2 + stepOffset)}</span><div><h3>بازه زمانی</h3><p>در صورت نیاز، دوره مرتبط با درخواست را وارد کنید. این بخش اختیاری است.</p></div><span class="financial-optional-badge">اختیاری</span></div><div class="financial-form-grid financial-period-grid"><div class="form-field"><label for="financialYear">سال شمسی</label><input id="financialYear" name="jalaliYear" type="number" min="1300" max="${ReportRules.currentPeriod().year}" inputmode="numeric" placeholder="مثلاً ۱۴۰۵" value="${esc(item?.jalaliYear || '')}"></div><div class="form-field"><label for="financialMonth">ماه</label><input id="financialMonth" name="jalaliMonth" type="number" min="1" max="12" inputmode="numeric" placeholder="۱ تا ۱۲" value="${esc(item?.jalaliMonth || '')}"></div></div></section>
  <section class="financial-form-section"><div class="financial-section-heading"><span class="financial-section-index">${fa(3 + stepOffset)}</span><div><h3>توضیحات</h3><p>جزئیات موردنیاز برای تصمیم‌گیری را اضافه کنید.</p></div></div><div class="financial-description-grid"><div class="form-field"><label for="financialDescription">شرح درخواست</label><textarea id="financialDescription" name="description" rows="3" maxlength="2000" placeholder="نیاز خانواده و علت درخواست را توضیح دهید…">${esc(item?.description || '')}</textarea></div><div class="form-field financial-private-note"><label for="financialInstitutionNote">یادداشت مؤسسه <span>داخلی</span></label><textarea id="financialInstitutionNote" name="institutionNote" rows="3" maxlength="2000" placeholder="یادداشت داخلی برای پیگیری همکاران…">${esc(item?.institutionNote || '')}</textarea><small class="financial-field-help">این یادداشت برای پیگیری داخلی مؤسسه است.</small></div></div></section>
  <div id="financialError" class="message error" role="alert" aria-live="polite"></div><div class="modal-actions financial-form-actions"><button id="saveFinancial" class="primary" type="submit">${edit ? 'ذخیره تغییرات' : 'ثبت درخواست'}</button><button class="secondary" type="button" data-close>انصراف</button></div></form></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    if (!f) {
        const search = $('#financialFamilySearch'), select = $('#financialFamilySelect'), summary = $('#financialFamilySummary');
        search.oninput = () => { const q = search.value.trim().toLocaleLowerCase('fa'); [...select.options].slice(1).forEach(option => { option.hidden = Boolean(q) && !option.textContent.toLocaleLowerCase('fa').includes(q); }); };
        select.onchange = () => { const chosen = families.find(x => x.id === select.value); summary.textContent = chosen ? `${chosen.headName || ''} · ${chosen.familySurname || ''} · پرونده ${chosen.caseNumber || '—'}` : 'برای ادامه، خانوادهٔ مرتبط را انتخاب کنید.'; };
    }
    $('#financialForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity())
            return;
        const fd = new FormData(form), targetFamily = f || families.find(x => x.id === String(fd.get('familyId') || ''));
        if (!targetFamily) {
            $('#financialFamilySelect')?.reportValidity();
            return;
        }
        const body = { title: String(fd.get('title')).trim(), category: String(fd.get('category')), requestType: String(fd.get('requestType') || 'ad_hoc'), amount: String(fd.get('amount')), jalaliYear: fd.get('jalaliYear') ? String(fd.get('jalaliYear')) : null, jalaliMonth: fd.get('jalaliMonth') ? String(fd.get('jalaliMonth')) : null, description: String(fd.get('description') || '').trim(), institutionNote: String(fd.get('institutionNote') || '').trim() }, button = $('#saveFinancial');
        button.disabled = true;
        try {
            await api(edit ? '/api/financial-cases/' + encodeURIComponent(item.id) : '/api/families/' + encodeURIComponent(targetFamily.id) + '/financial-cases', { method: edit ? 'PATCH' : 'POST', body: JSON.stringify(body) });
            closeModal();
            toast(edit ? 'مورد مالی به‌روزرسانی شد.' : 'درخواست مالی ثبت شد.');
            if (edit) {
                await loadFinancialCases(targetFamily);
            }
            else {
                selectedId = targetFamily.id;
                await loadFamilies();
                await loadDetail(targetFamily.id);
            }
        }
        catch (err) {
            button.disabled = false;
            $('#financialError').textContent = err.data?.issues?.[0]?.message || err.message;
        }
    };
}

function openArchiveDialog(f, archive) { const action = archive ? 'آرشیو' : 'بازگردانی'; AppUI.mountModal(`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">${archive ? 'خارج‌کردن از پرونده‌های فعال' : 'بازگشت به پرونده‌های فعال'}</div><h2>${action} پرونده ${esc(f.caseNumber)}</h2></div><button class="close-btn" data-close>×</button></div><p>${archive ? 'پس از آرشیو، پرونده قابل مشاهده است اما تا زمان بازگردانی ویرایش نمی‌شود.' : 'پرونده دوباره فعال و قابل ویرایش خواهد شد.'}</p><label for="archiveReason"><b>دلیل ${action}</b></label><textarea id="archiveReason" class="archive-reason" minlength="3" maxlength="500" placeholder="دلیل این اقدام را ثبت کنید…"></textarea><div id="archiveError" class="message error"></div><div class="modal-actions"><button id="confirmArchive" class="${archive ? 'danger' : 'primary'}">تأیید ${action}</button><button class="secondary" data-close>انصراف</button></div></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#confirmArchive').onclick = async () => { const reason = $('#archiveReason').value.trim(); if (reason.length < 3) {
    $('#archiveError').textContent = 'ثبت دلیل با حداقل ۳ نویسه الزامی است.';
    return;
} const b = $('#confirmArchive'); b.disabled = true; try {
    await api('/api/families/' + encodeURIComponent(f.id) + '/' + (archive ? 'archive' : 'unarchive'), { method: 'POST', body: JSON.stringify({ reason }) });
    closeModal();
    toast(archive ? 'پرونده با موفقیت آرشیو شد.' : 'پرونده با موفقیت بازگردانی شد.');
    selectedId = null;
    await loadFamilies();
}
catch (e) {
    b.disabled = false;
    $('#archiveError').textContent = e.message;
} }; }

async function transitionFinancial(f, id, action) { let reason, approvedAmount; if (['reject', 'cancel', 'approve'].includes(action)) {
    reason = prompt(action === 'approve' ? 'نظر و دلیل تأیید:' : action === 'cancel' ? 'دلیل لغو:' : 'دلیل رد درخواست:');
    if (!reason || reason.trim().length < 3)
        return;
} if (action === 'approve') {
    approvedAmount = await AppUI.promptMoney({title:'مبلغ مورد تأیید',min:'1'});
    if (!approvedAmount || Number(approvedAmount) <= 0)
        return;
} try {
    await api('/api/financial-cases/' + id + '/transition', { method: 'POST', body: JSON.stringify({ action, reason, approvedAmount }) });
    toast('وضعیت به‌روزرسانی شد.');
    loadFinancialCases(f);
}
catch (e) {
    toast(e.message);
} }

function jalaliNow() { const p = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric' }).formatToParts(new Date()), v = t => Number(p.find(x => x.type === t)?.value); return { year: v('year'), month: v('month') }; }

async function openPaymentForm(f, item) { const n = jalaliNow(), y = item.jalaliYear || n.year, m = item.jalaliMonth || n.month, d = await api(`/api/funds?jalaliYear=${y}&jalaliMonth=${m}`), funds = d.funds.filter(x => x.active); if (!funds.length)
    return toast('ابتدا صندوق و بودجه تعریف کنید.'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>ثبت پرداخت</h2><button class="close-btn" data-close>×</button></div><form id="paymentForm"><div class="form-grid"><div class="form-field full"><label>صندوق</label><select name="fundId">${funds.map(x => `<option value="${x.id}">${esc(x.name)} — مانده ${money(x.remaining)}</option>`).join('')}</select></div><div class="form-field"><label>سال شمسی</label><input name="jalaliYear" type="number" value="${y}" required></div><div class="form-field"><label>ماه</label><input name="jalaliMonth" type="number" min="1" max="12" value="${m}" required></div><div class="form-field"><label>تاریخ پرداخت</label><input name="paidAt" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div class="form-field"><label>شماره پیگیری</label><input name="referenceNo" minlength="2" required></div><div class="form-field full"><label>رسید (اختیاری، حداکثر ۸ مگابایت)</label><input name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div><div class="form-field full"><label>یادداشت</label><textarea name="note"></textarea></div></div><div id="paymentError" class="message error"></div><div class="modal-actions"><button class="primary">ثبت پرداخت</button><button class="secondary" type="button" data-close>انصراف</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); const paymentForm=$('#paymentForm');let paymentKey=null,paymentSignature=null;
 paymentForm.onsubmit=async event=>{
   event.preventDefault();
   return AppUI.runPending(paymentForm,async()=>{
     try {
       const fd=new FormData(paymentForm),file=fd.get('receipt');let receipt=null;
       if(file&&file.size){
         if(file.size>8388608)throw new Error('حجم رسید بیش از ۸ مگابایت است.');
         receipt={fileName:file.name,mimeType:file.type,contentBase64:await fileBase64(file)};
       }
       const payload=JSON.stringify({fundId:String(fd.get('fundId')),jalaliYear:Number(fd.get('jalaliYear')),jalaliMonth:Number(fd.get('jalaliMonth')),paidAt:String(fd.get('paidAt')),referenceNo:String(fd.get('referenceNo')).trim(),note:String(fd.get('note')||''),receipt});
       if(payload!==paymentSignature){paymentKey=AppUI.requestKey();paymentSignature=payload;}
       await api('/api/financial-cases/'+item.id+'/pay',{method:'POST',headers:{'idempotency-key':paymentKey},body:payload});
       closeModal();toast('پرداخت ثبت شد.');await loadFinancialCases(f);
     } catch(error){AppUI.message(paymentForm,error.message);}
   });
 };
}

async function openFunds() { const n = jalaliNow(), d = await api(`/api/funds?jalaliYear=${n.year}&jalaliMonth=${n.month}`); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">دوره ${fa(n.year)}/${fa(n.month)}</div><h2>صندوق‌ها و بودجه</h2></div><button class="close-btn" data-close>×</button></div>${actor?.role === 'admin' ? '<button id="newFundBtn" class="primary">صندوق جدید</button>' : ''}<div class="fund-grid">${d.funds.map(x => `<article class="fund-card"><h4>${esc(x.name)} ${x.active ? '' : '(غیرفعال)'}</h4><p>${esc(x.description || '')}</p><div class="budget-row"><span>بودجه</span><b>${money(x.budget)}</b></div><div class="budget-row"><span>پرداخت</span><b>${money(x.spent)}</b></div><div class="budget-row"><span>مانده</span><b>${money(x.remaining)}</b></div>${actor?.role === 'admin' ? `<div class="workflow-actions"><button class="secondary" data-budget="${x.id}">بودجه</button><button class="secondary" data-toggle="${x.id}" data-active="${x.active}">${x.active ? 'غیرفعال' : 'فعال'}</button></div>` : ''}</article>`).join('') || '<div class="empty-state">صندوقی تعریف نشده است.</div>'}</div></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#newFundBtn') && ($('#newFundBtn').onclick = async () => { const name = prompt('نام صندوق:'); if (!name)
    return; await api('/api/funds', { method: 'POST', body: JSON.stringify({ name, description: prompt('توضیح:') || '' }) }); openFunds(); }); document.querySelectorAll('[data-budget]').forEach(b => b.onclick = async () => { const amount = await AppUI.promptMoney({title:'بودجه این ماه'}); if (amount === null)
    return; await api('/api/funds/' + b.dataset.budget + '/budget', { method: 'PUT', body: JSON.stringify({ jalaliYear: n.year, jalaliMonth: n.month, amount: Number(amount) }) }); openFunds(); }); document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => { await api('/api/funds/' + b.dataset.toggle, { method: 'PATCH', body: JSON.stringify({ active: b.dataset.active !== 'true' }) }); openFunds(); }); }
