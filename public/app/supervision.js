/* Feature: supervision. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const reportStatusNames = { draft: 'پیش‌نویس', submitted: 'منتظر تأیید', approved: 'تأییدشده', revision_requested: 'نیازمند اصلاح' }, reportPriorityNames = { low: 'کم', normal: 'عادی', high: 'بالا', urgent: 'فوری' };

function saturdayOf(date = new Date()) { const d = new Date(date), diff = (d.getDay() + 1) % 7; d.setDate(d.getDate() - diff); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

async function loadWeeklyReports(f) { const box = $('#supervisionSection'); if (!box)
    return; try {
    const d = await api('/api/families/' + f.id + '/supervision-reports'), canCreate = actor?.position === 'liaison' && !f.archived;
    box.innerHTML = `<div class="finance-head"><div><div class="eyebrow">پیگیری غیرمستقیم از طریق سرپرست</div><h3>گزارش هفتگی</h3></div>${canCreate ? '<button id="newWeeklyReportBtn" class="primary">گزارش این هفته</button>' : ''}</div>${d.plan ? `<div class="finance-summary"><span class="count-chip">دوره: هر ${fa(d.plan.frequencyDays)} روز</span><span class="count-chip">موعد بعدی: ${esc(d.plan.nextDueAt)}</span></div>` : '<div class="muted">برنامه پیگیری پس از تعیین سرپرست فعال می‌شود.</div>'}<div class="finance-list">${d.reports.map(r => `<article class="finance-card"><div class="finance-card-head"><div><h4>هفته ${esc(r.weekStart)}</h4><div class="finance-meta">${esc(r.liaisonName)} · اولویت ${esc(reportPriorityNames[r.priority] || r.priority)}</div></div><span class="finance-status">${esc(reportStatusNames[r.status] || r.status)}</span></div><p>${esc(r.summary)}</p>${r.proposedActions ? `<p class="finance-note">اقدام پیشنهادی: ${esc(r.proposedActions)}</p>` : ''}${r.reviewNote ? `<p class="finance-note">نظر بررسی: ${esc(r.reviewNote)}</p>` : ''}${r.status === 'approved' && r.financialStatus === 'none' ? `<button class="secondary" data-source-finance="${r.id}" data-source-type="weekly_report">درخواست مالی</button>` : ''}</article>`).join('') || '<div class="empty-state" style="min-height:80px">گزارشی ثبت نشده است.</div>'}</div>`;
    $('#newWeeklyReportBtn') && ($('#newWeeklyReportBtn').onclick = () => openWeeklyReportForm(f));
    box.querySelectorAll('[data-source-finance]').forEach(b => b.onclick = () => openSourceFinancialForm(f, b.dataset.sourceType, b.dataset.sourceFinance));
}
catch (e) {
    box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
} }

function openWeeklyReportForm(f) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">تماس هفتگی با سرپرست</div><h2>گزارش ${esc(f.headName)}</h2></div><button class="close-btn" data-close>×</button></div><form id="weeklyReportForm"><div class="form-grid"><div class="form-field"><label>شروع هفته</label><input name="weekStart" type="date" value="${saturdayOf()}" required></div><div class="form-field"><label>زمان تماس</label><input name="contactAt" type="datetime-local" required></div><div class="form-field"><label>روش ارتباط</label><select name="contactMethod"><option value="phone">تماس تلفنی</option><option value="message">پیام</option><option value="in_person_with_supervisor">دیدار با سرپرست</option></select></div><div class="form-field"><label>اولویت دستی</label><select name="priority"><option value="normal">عادی</option><option value="high">بالا</option><option value="urgent">فوری</option><option value="low">کم</option></select></div>${[['contactSuccessful', 'ارتباط موفق بود'], ['healthConcern', 'نگرانی درمانی'], ['educationConcern', 'نگرانی آموزشی'], ['urgentNeed', 'نیاز فوری']].map(x => `<div class="form-field"><label><input type="checkbox" name="${x[0]}"> ${x[1]}</label></div>`).join('')}<div class="form-field"><label>تغییر مسکن</label><select name="housingChange"><option value="none">بدون تغییر</option><option value="improved">بهبود</option><option value="worse">بدتر شده</option><option value="unknown">نامشخص</option></select></div><div class="form-field"><label>تغییر درآمد</label><select name="incomeChange"><option value="none">بدون تغییر</option><option value="improved">بهبود</option><option value="worse">بدتر شده</option><option value="unknown">نامشخص</option></select></div><div class="form-field full"><label>خلاصه گزارش</label><textarea name="summary" required minlength="3"></textarea></div><div class="form-field full"><label>توضیح چک‌لیست</label><textarea name="checklistNotes"></textarea></div><div class="form-field full"><label>اقدامات پیشنهادی</label><textarea name="proposedActions"></textarea></div></div><div id="weeklyError" class="message error"></div><div class="modal-actions"><button class="primary">ثبت و ارسال برای تأیید</button><button class="secondary" type="button" data-close>انصراف</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#weeklyReportForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), contact = String(fd.get('contactAt') || ''); if (!contact)
    return; const body = { weekStart: String(fd.get('weekStart')), contactAt: new Date(contact).toISOString(), contactMethod: String(fd.get('contactMethod')), priority: String(fd.get('priority')), summary: String(fd.get('summary')), proposedActions: String(fd.get('proposedActions') || ''), checklist: { contactSuccessful: fd.get('contactSuccessful') === 'on', housingChange: String(fd.get('housingChange')), incomeChange: String(fd.get('incomeChange')), healthConcern: fd.get('healthConcern') === 'on', educationConcern: fd.get('educationConcern') === 'on', urgentNeed: fd.get('urgentNeed') === 'on', notes: String(fd.get('checklistNotes') || '') } }; try {
    const created = await api('/api/families/' + f.id + '/supervision-reports', { method: 'POST', body: JSON.stringify(body) });
    await api('/api/supervision-reports/' + created.reportId + '/submit', { method: 'POST', body: '{}' });
    closeModal();
    toast('گزارش برای معاون سرپرستی ارسال شد.');
    loadWeeklyReports(f);
}
catch (err) {
    $('#weeklyError').textContent = err.message;
} }; }

async function openSupervisionInbox() { try {
    const d = await api('/api/supervision/inbox');
    if (d.mode === 'liaison') {
        AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">کارتابل رابط</div><h2>پیگیری‌های هفتگی</h2></div><button class="close-btn" data-close>×</button></div>${d.due.map(x => `<div class="user-row"><div><b>${esc(x.headName)} · پرونده ${esc(x.caseNumber)}</b><p>سرپرست: ${esc(x.supervisorName)} · موعد: ${esc(x.nextDueAt)} ${x.overdue ? '· عقب‌افتاده' : ''}</p></div><button class="secondary" data-open-family="${x.familyId}">بازکردن پرونده</button></div>`).join('') || '<div class="empty-state">پیگیری سررسیدشده‌ای نیست.</div>'}</div></div>`);
        document.querySelectorAll('[data-open-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.openFamily); });
    }
    else {
        AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">کارتابل معاون سرپرستی</div><h2>گزارش‌های منتظر تأیید</h2></div><button class="close-btn" data-close>×</button></div>${d.pending.map(x => `<article class="finance-card"><div class="finance-card-head"><div><h4>${esc(x.headName)} · ${esc(x.caseNumber)}</h4><div class="finance-meta">${esc(x.liaisonName)} · سرپرست ${esc(x.supervisorName)} · اولویت ${esc(reportPriorityNames[x.priority])}</div></div></div><p>${esc(x.summary)}</p><div class="workflow-actions"><button class="primary" data-review-report="${x.id}" data-decision="approve">تأیید</button><button class="secondary" data-review-report="${x.id}" data-decision="revision">درخواست اصلاح</button></div></article>`).join('') || '<div class="empty-state">گزارشی منتظر تأیید نیست.</div>'}<h3>پیگیری‌های عقب‌افتاده</h3>${d.overdue.map(x => `<div class="user-row"><div><b>${esc(x.headName)}</b><p>${esc(x.liaisonName)} · موعد ${esc(x.nextDueAt)}</p></div></div>`).join('') || '<div class="muted">موردی نیست.</div>'}</div></div>`);
        document.querySelectorAll('[data-review-report]').forEach(b => b.onclick = async () => { const decision = b.dataset.decision, note = decision === 'revision' ? prompt('دلیل اصلاح:') || '' : ''; try {
            await api('/api/supervision-reports/' + b.dataset.reviewReport + '/review', { method: 'POST', body: JSON.stringify({ decision, note }) });
            openSupervisionInbox();
        }
        catch (e) {
            toast(e.message);
        } });
    }
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}
catch (e) {
    toast(e.message);
} }

async function openSourceFinancialForm(f, sourceType, sourceId) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">${esc(sourceTypeNames[sourceType])}</div><h2>ساخت درخواست مالی</h2></div><button class="close-btn" data-close>×</button></div><form id="sourceFinanceForm"><div class="form-grid"><div class="form-field"><label>عنوان</label><input name="title" required minlength="2"></div><div class="form-field"><label>دسته‌بندی</label><select name="category">${['لوازم آموزشی', 'بهداشت و درمان', 'بیمه', 'کلاس آموزشی', 'خرید لوازم منزل', 'معیشت', 'قسط', 'اهدایی'].map(x => `<option>${x}</option>`).join('')}</select></div><div class="form-field"><label>مبلغ</label><input name="amount" type="number" min="1" required></div><div class="form-field"><label>سال شمسی</label><input name="jalaliYear" type="number" min="1300"></div><div class="form-field"><label>ماه</label><input name="jalaliMonth" type="number" min="1" max="12"></div><div class="form-field full"><label>شرح و برآورد</label><textarea name="description"></textarea></div></div><div id="sourceFinanceError" class="message error"></div><div class="modal-actions"><button class="primary">ثبت درخواست</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#sourceFinanceForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), body = { sourceType, sourceId, title: String(fd.get('title')).trim(), category: String(fd.get('category')), amount: String(fd.get('amount')), jalaliYear: fd.get('jalaliYear') ? String(fd.get('jalaliYear')) : null, jalaliMonth: fd.get('jalaliMonth') ? String(fd.get('jalaliMonth')) : null, description: String(fd.get('description') || ''), institutionNote: '' }; try {
    await api('/api/financial-sources/request', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    toast('درخواست مالی از منبع ثبت شد.');
    loadDetail(f.id);
}
catch (err) {
    $('#sourceFinanceError').textContent = err.message;
} }; }

function uploadFinancialDocument(f, id) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>پیوست مالی</h2><button class="close-btn" data-close>×</button></div><form id="financialDocForm"><div class="form-grid"><div class="form-field"><label>نوع</label><select name="documentType"><option value="cost_estimate">برآورد هزینه</option><option value="invoice">فاکتور</option><option value="supporting_document">مدرک پشتیبان</option><option value="other">سایر</option></select></div><div class="form-field"><label>فایل</label><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></div><div class="form-field full"><label>توضیح</label><textarea name="description"></textarea></div></div><div class="modal-actions"><button class="primary">بارگذاری</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#financialDocForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), file = fd.get('file'); if (!file || !file.size || file.size > 8388608)
    return toast('فایل معتبر تا ۸ مگابایت انتخاب کنید.'); await api('/api/financial-cases/' + id + '/documents', { method: 'POST', body: JSON.stringify({ documentType: String(fd.get('documentType')), fileName: file.name, mimeType: file.type, description: String(fd.get('description') || ''), contentBase64: await fileBase64(file) }) }); closeModal(); toast('پیوست مالی به همین درخواست متصل شد.'); loadFinancialCases(f); }; }
