/* Feature: specialist-actions. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const healthFlow = ['new_referral', 'initial_assessment', 'appointment_scheduled', 'in_treatment', 'completed'], educationFlow = ['new_referral', 'assessment', 'support_plan', 'follow_up', 'completed'], specialistStatusNames = { new_referral: 'ارجاع جدید', initial_assessment: 'بررسی اولیه', appointment_scheduled: 'نوبت‌گذاری', in_treatment: 'در حال درمان', assessment: 'ارزیابی', support_plan: 'برنامه حمایتی', follow_up: 'در حال پیگیری', completed: 'تکمیل‌شده', cancelled: 'لغوشده' }, urgencyNames = { normal: 'عادی', important: 'مهم', urgent: 'فوری', critical: 'بحرانی' };

async function loadSpecialistCases(f) { const box = $('#specialistSection'); if (!box)
    return; try {
    const d = await api('/api/families/' + f.id + '/specialist-cases');
    if (d.restricted) {
        box.innerHTML = '<div class="empty-state"><h3>اطلاعات تخصصی محدود است</h3><p>ارزیابی‌ها و اسناد تخصصی فقط برای مسئول مجاز همان حوزه نمایش داده می‌شوند.</p></div>';
        return;
    }
    const canCreate = !f.archived && d.availableReferrals.length > 0;
    box.innerHTML = `<div class="finance-head"><div><div class="eyebrow"></div><h3>پیگیری تخصصی درمان و آموزش</h3><p class="specialist-purpose">وقتی در تماس با خانواده نیاز تخصصی درمانی یا آموزشی شناسایی می‌شود، ارجاع به کارشناس، ثبت ارزیابی و پیگیری نتیجه در این بخش انجام می‌شود؛ درخواست مالی در بخش مالی ثبت می‌ماند.</p></div>${canCreate ? '<button id="newSpecialistBtn" class="primary">تشکیل پرونده تخصصی</button>' : ''}</div><div class="finance-list">${d.cases.map(c => `<article class="finance-card"><div class="finance-card-head"><div><h4>${c.domain === 'health' ? 'درمان' : 'آموزش'} — ${esc(c.memberName || f.headName)}</h4><div class="finance-meta">مسئول: ${esc(c.assignedToName)} · فوریت: ${esc(urgencyNames[c.urgency] || c.urgency)}</div></div><span class="finance-status">${esc(specialistStatusNames[c.status] || c.status)}</span></div><p>${esc(c.summary)}</p>${c.assessment ? `<p class="finance-note"><b>ارزیابی:</b> ${esc(c.assessment)}</p>` : ''}${c.supportPlan ? `<p class="finance-note"><b>برنامه حمایت:</b> ${esc(c.supportPlan)}</p>` : ''}${c.result ? `<p class="finance-note"><b>نتیجه:</b> ${esc(c.result)}</p>` : ''}<div class="finance-meta">${c.appointmentAt ? 'نوبت: ' + esc(new Date(c.appointmentAt).toLocaleString('fa-IR')) + ' · ' : ''}${c.estimatedCost ? 'برآورد: ' + money(c.estimatedCost) + ' تومان · ' : ''}${c.actualCost ? 'واقعی: ' + money(c.actualCost) + ' تومان' : ''}</div>${c.paymentId && c.receiptFileName ? `<button class="receipt-link" data-secure-download="/api/payments/${c.paymentId}/receipt">رسید پرداخت پرونده تخصصی</button>` : ''}<div class="case-attachments"><div class="case-attachments-title"><strong>مدارک مرتبط با این پرونده</strong><span>${fa((c.documents || []).length)} پیوست</span></div>${(c.documents || []).map(doc => `<div class="case-attachment-row"><span>▤</span><div><b>${esc(doc.fileName)}</b><small>${esc(doc.documentType)}${doc.description ? ' · ' + esc(doc.description) : ''}</small></div><button type="button" class="secondary" data-secure-download="/api/specialist-documents/${esc(doc.id)}/download">دریافت</button></div>`).join('') || '<p class="case-attachments-empty">مدرکی به این پرونده متصل نشده است.</p>'}</div><div class="workflow-actions">${c.status === 'completed' && c.financialStatus === 'none' ? `<button class="secondary" data-c5-specialist="${c.id}" data-c5-type="${c.domain === 'health' ? 'health_case' : 'education_case'}">درخواست مالی</button>` : ''}${!['completed', 'cancelled'].includes(c.status) ? `<button class="secondary" data-edit-specialist="${c.id}">ثبت اطلاعات</button><button class="primary" data-next-specialist="${c.id}" data-domain="${c.domain}" data-status="${c.status}">مرحله بعد</button><button class="secondary" data-doc-specialist="${c.id}">افزودن مدرک</button>` : ''}</div></article>`).join('') || '<div class="empty-state" style="min-height:80px">پرونده تخصصی تشکیل نشده است.</div>'}</div>`;
    $('#newSpecialistBtn') && ($('#newSpecialistBtn').onclick = () => createSpecialistCase(f, d.availableReferrals));
    box.querySelectorAll('[data-c5-specialist]').forEach(b => b.onclick = () => openSourceFinancialForm(f, b.dataset.c5Type, b.dataset.c5Specialist));
    box.querySelectorAll('[data-edit-specialist]').forEach(b => b.onclick = () => editSpecialistCase(f, d.cases.find(x => x.id === b.dataset.editSpecialist)));
    box.querySelectorAll('[data-next-specialist]').forEach(b => b.onclick = () => nextSpecialistStatus(f, b.dataset.nextSpecialist, b.dataset.domain, b.dataset.status));
    box.querySelectorAll('[data-doc-specialist]').forEach(b => b.onclick = () => uploadSpecialistDocument(f, b.dataset.docSpecialist));
}
catch (e) {
    box.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
} }

async function createSpecialistCase(f, refs) { const menu = refs.map((r, i) => `${i + 1}. ${r.domain === 'health' ? 'درمان' : 'آموزش'} — ${r.reason}`).join('\n'), n = Number(prompt('ارجاع را انتخاب کنید:\n' + menu)); if (!n || !refs[n - 1])
    return; const r = refs[n - 1], summary = prompt('خلاصه مشکل یا نیاز:'); if (!summary || summary.trim().length < 3)
    return; const urgency = prompt('فوریت: normal، important، urgent یا critical', 'normal'); if (!['normal', 'important', 'urgent', 'critical'].includes(urgency))
    return; await api('/api/families/' + f.id + '/specialist-cases', { method: 'POST', body: JSON.stringify({ domain: r.domain, referralId: r.referralId, actionId: r.actionId || null, summary, urgency }) }); toast('پرونده تخصصی تشکیل شد.'); loadSpecialistCases(f); }

async function editSpecialistCase(f, c) { const body = {}; if (c.domain === 'health') {
    body.assessment = prompt('تشخیص یا ارزیابی اولیه:', c.assessment || '') || '';
    body.providerName = prompt('نام پزشک:', c.providerName || '') || '';
    body.centerName = prompt('مرکز درمانی:', c.centerName || '') || '';
    body.serviceType = prompt('نوع خدمت:', c.serviceType || '') || '';
}
else {
    body.grade = prompt('پایه تحصیلی:', c.grade || '') || '';
    body.school = prompt('مدرسه:', c.school || '') || '';
    body.academicYear = prompt('سال تحصیلی:', c.academicYear || '') || '';
    body.educationIssue = prompt('مشکل آموزشی:', c.educationIssue || '') || '';
    body.supportPlan = prompt('برنامه حمایتی:', c.supportPlan || '') || '';
    body.progressEvaluation = prompt('ارزیابی پیشرفت:', c.progressEvaluation || '') || '';
} body.result = prompt('نتیجه فعلی:', c.result || '') || ''; const estimated = await AppUI.promptMoney({title:'هزینه تخمینی',value:c.estimatedCost ?? '',required:false}); if(estimated===null)return; if (estimated !== '')
    body.estimatedCost = Number(estimated); const actual = await AppUI.promptMoney({title:'هزینه واقعی',value:c.actualCost ?? '',required:false}); if(actual===null)return; if (actual !== '')
    body.actualCost = Number(actual); await api('/api/specialist-cases/' + c.id, { method: 'PATCH', body: JSON.stringify(body) }); toast('اطلاعات تخصصی ذخیره شد.'); loadSpecialistCases(f); }

async function nextSpecialistStatus(f, id, domain, status) { const flow = domain === 'health' ? healthFlow : educationFlow, i = flow.indexOf(status), to = flow[i + 1]; if (!to)
    return; const note = prompt('توضیح انتقال به «' + specialistStatusNames[to] + '»:') || ''; try {
    await api('/api/specialist-cases/' + id + '/transition', { method: 'POST', body: JSON.stringify({ to, note }) });
    toast('مرحله پرونده به‌روزرسانی شد.');
    loadSpecialistCases(f);
}
catch (e) {
    toast(e.message);
} }

function uploadSpecialistDocument(f, id) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>افزودن مدرک تخصصی</h2><button class="close-btn" data-close>×</button></div><form id="specialistDocForm"><div class="form-grid"><div class="form-field"><label>نوع مدرک</label><select name="documentType"><option value="medical_record">مدرک پزشکی</option><option value="prescription">نسخه</option><option value="estimate">برآورد هزینه</option><option value="invoice">فاکتور</option><option value="education_report">گزارش آموزشی</option><option value="school_document">مدرک مدرسه</option><option value="other">سایر</option></select></div><div class="form-field"><label>فایل</label><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></div><div class="form-field full"><label>توضیح</label><textarea name="description"></textarea></div></div><div class="modal-actions"><button class="primary">بارگذاری</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#specialistDocForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), file = fd.get('file'); if (!file || !file.size || file.size > 8388608)
    return toast('فایل معتبر تا ۸ مگابایت انتخاب کنید.'); await api('/api/specialist-cases/' + id + '/documents', { method: 'POST', body: JSON.stringify({ documentType: String(fd.get('documentType')), fileName: file.name, mimeType: file.type, description: String(fd.get('description') || ''), contentBase64: await fileBase64(file) }) }); closeModal(); toast('مدرک ثبت شد.'); loadSpecialistCases(f); }; }

async function openSpecialistInbox() { try {
    const d = await api('/api/specialist-cases/inbox');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow"></div><h2>کارتابل تخصصی ${d.domain === 'health' ? 'درمان' : d.domain === 'education' ? 'آموزش' : ''}</h2></div><button class="close-btn" data-close>×</button></div>${d.items.map(x => `<button class="family-item" data-specialist-family="${x.familyId}"><div class="family-item-head"><b>${esc(x.headName)} · ${esc(x.caseNumber)}</b><span class="status">${esc(specialistStatusNames[x.status] || x.status)}</span></div><p>${esc(x.summary)} · ${esc(urgencyNames[x.urgency] || x.urgency)}</p></button>`).join('') || '<div class="empty-state">پرونده فعالی در کارتابل نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-specialist-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.specialistFamily); });
}
catch (e) {
    toast(e.message);
} }

async function loadActionPlan(f) { const box = $('#actionSection'); if (!box)
    return; if (window.ActionBoard)
    return window.ActionBoard.load(f, box); box.innerHTML = '<div class="empty-state">کارتابل اقدامات در حال آماده‌سازی است.</div>'; }

const actionStatusNames = { proposed: 'پیشنهادشده', assigned: 'تخصیص‌یافته', completed: 'منتظر تأیید نتیجه', revision_requested: 'نیازمند اصلاح', approved: 'تأیید و بسته‌شده', cancelled: 'لغوشده' };

async function proposeAction(f, reports) { const title = prompt('عنوان اقدام:'); if (!title || title.trim().length < 3)
    return; const domain = prompt('حوزه اقدام: general، health یا education', 'general'); if (!['general', 'health', 'education'].includes(domain))
    return; const description = prompt('شرح اقدام:') || ''; await api('/api/supervision-reports/' + reports[0].id + '/actions', { method: 'POST', body: JSON.stringify({ title, description, domain }) }); toast('اقدام برای بررسی معاون ثبت شد.'); loadActionPlan(f); }

async function assignAction(f, id, domain) { let users = (await api('/api/assignees')).users; if (domain === 'health')
    users = users.filter(u => ['health_deputy', 'health_officer'].includes(u.position)); if (domain === 'education')
    users = users.filter(u => ['education_deputy', 'education_officer'].includes(u.position)); if (!users.length)
    return toast('مسئول متناسب با حوزه اقدام تعریف نشده است.'); const menu = users.map((u, i) => `${i + 1}. ${u.name}`).join('\n'), choice = Number(prompt('مسئول را انتخاب کنید:\n' + menu)); if (!choice || !users[choice - 1])
    return; const dueDate = prompt('مهلت انجام به میلادی (YYYY-MM-DD):'); if (!dueDate)
    return; const note = prompt('توضیح تخصیص:') || ''; try {
    await api('/api/actions/' + id + '/assign', { method: 'POST', body: JSON.stringify({ assigneeId: users[choice - 1].id, dueDate, note }) });
    toast('مسئول و مهلت تعیین شد.');
    loadActionPlan(f);
}
catch (e) {
    toast(e.message);
} }

async function completeAction(f, id) { const result = prompt('نتیجه انجام اقدام:'); if (!result || result.trim().length < 3)
    return; await api('/api/actions/' + id + '/complete', { method: 'POST', body: JSON.stringify({ result }) }); toast('نتیجه برای تأیید معاون ارسال شد.'); loadActionPlan(f); }

async function reviewAction(f, id, decision) { const note = prompt(decision === 'approve' ? 'نظر تأیید نتیجه:' : 'دلیل برگشت برای اصلاح:') || ''; if (decision === 'revision' && note.trim().length < 3)
    return; await api('/api/actions/' + id + '/review', { method: 'POST', body: JSON.stringify({ decision, note }) }); toast('نتیجه اقدام بررسی شد.'); loadActionPlan(f); }
