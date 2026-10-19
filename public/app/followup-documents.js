/* Feature: followup-documents. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
function followupDate(value, withTime = false) { if (!value)
    return 'ثبت نشده'; const date = new Date(value); if (Number.isNaN(date.getTime()))
    return 'ثبت نشده'; const options = { calendar: 'persian', numberingSystem: 'arabext', timeZone: 'Asia/Tehran', dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }; return new Intl.DateTimeFormat('fa-IR', options).format(date); }

function noteViewModel(n) { const status = n.followUpStatus || n.status || 'یادداشت', dueDate = n.nextFollowUpAt ? new Date(n.nextFollowUpAt) : null, finished = ['انجام شد', 'لغو شد'].includes(status), overdue = Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < new Date() && !finished), filter = status === 'در حال پیگیری' ? 'progress' : status === 'انجام شد' ? 'done' : status === 'لغو شد' ? 'cancelled' : finished ? 'done' : 'active'; return { ...n, status, dueDate, finished, overdue, filter }; }

function noteTimeline(f, canWrite = false) { const notes = (f.notesHistory || []).map(noteViewModel), active = notes.filter(n => !n.finished).length, overdue = notes.filter(n => n.overdue).length, done = notes.filter(n => n.status === 'انجام شد').length, next = notes.filter(n => n.dueDate && n.dueDate >= new Date() && !n.finished).sort((a, b) => a.dueDate - b.dueDate)[0], items = notes.map((n, index) => `<article class="followup-event" data-followup-item data-filter="${esc(n.filter)}" data-status="${esc(n.status)}" data-overdue="${n.overdue}"><span class="followup-event-marker">${n.overdue ? '!' : n.status === 'انجام شد' ? '✓' : fa(index + 1)}</span><div class="followup-event-card"><div class="followup-event-top"><div class="followup-event-title"><b>${esc(n.status || 'پیگیری')}</b><small>${followupDate(n.createdAt, true)}</small></div><span class="followup-status-chip" data-status="${esc(n.status)}">${esc(n.status)}</span></div><p>${esc(n.text || 'بدون توضیح')}</p><div class="followup-event-meta"><span>مسئول: ${esc(n.assigneeName || 'تعیین نشده')}</span>${n.nextFollowUpAt ? `<span class="followup-due">${n.overdue ? 'عقب‌افتاده:' : 'موعد:'} ${followupDate(n.nextFollowUpAt)}</span>` : ''}</div>${n.institutionNote ? `<div class="followup-institution-note"><b>یادداشت مؤسسه:</b> ${esc(n.institutionNote)}</div>` : ''}${canWrite && n.id ? `<button type="button" class="followup-to-action" data-note-to-action="${esc(n.id)}">تبدیل به اقدام</button>` : ''}</div></article>`).join(''); return `<div class="followup-overview"><div><span>کل پیگیری‌ها</span><b>${fa(notes.length)}</b><small>رویداد ثبت‌شده</small></div><div><span>فعال</span><b>${fa(active)}</b><small>نیازمند ادامه</small></div><div data-tone="danger"><span>عقب‌افتاده</span><b>${fa(overdue)}</b><small>از موعد گذشته</small></div><div data-tone="success"><span>انجام‌شده</span><b>${fa(done)}</b><small>${next ? 'موعد بعدی ' + followupDate(next.nextFollowUpAt) : 'موعد بعدی ندارد'}</small></div></div><div class="followup-filters" role="toolbar" aria-label="فیلتر پیگیری‌ها"><button type="button" data-note-filter="all" aria-pressed="true">همه</button><button type="button" data-note-filter="active">باز و فعال</button><button type="button" data-note-filter="progress">در حال پیگیری</button><button type="button" data-note-filter="done">انجام‌شده</button><button type="button" data-note-filter="overdue">عقب‌افتاده</button></div><div class="followup-timeline">${items}</div><div class="followup-empty-filter" data-note-empty data-visible="${notes.length === 0}">${notes.length ? 'موردی در این فیلتر وجود ندارد.' : 'هنوز پیگیری یا یادداشتی ثبت نشده است.'}</div>`; }

function bindNoteTimeline(box, f) { const buttons = [...box.querySelectorAll('[data-note-filter]')], items = [...box.querySelectorAll('[data-followup-item]')], empty = box.querySelector('[data-note-empty]'); buttons.forEach(button => button.onclick = () => { const filter = button.dataset.noteFilter; buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button))); let visible = 0; items.forEach(item => { const show = filter === 'all' || filter === 'overdue' && item.dataset.overdue === 'true' || item.dataset.filter === filter; item.hidden = !show; if (show)
    visible++; }); if (empty)
    empty.dataset.visible = String(visible === 0); }); box.querySelectorAll('[data-note-to-action]').forEach(button => button.onclick = () => { const note = (f.notesHistory || []).find(item => item.id === button.dataset.noteToAction); window.ActionBoard?.openCreate(f, { sourceNoteId: note?.id, text: note?.text || '' }); }); }

function addSectionCollapse(section) { }

function refreshSectionCollapse() { const d = document.querySelector('#familyDetail'); if (!d)
    return; window.dispatchEvent(new CustomEvent('familysectionsrefresh')); }

function mountCaseExtensions(f) { const canWrite = ['admin', 'caseworker'].includes(actor?.role) && !f.archived; if (actor?.role !== 'admin') {
    const topical = document.createElement('section');
    topical.className = 'detail-section family-topic-attachments';
    topical.id = 'familyTopicAttachments';
    topical.innerHTML = `<div class="detail-section-title"><h3>پیوست‌های مرتبط با خانواده</h3><span class="muted">هر سند در موضوع خودش نگهداری می‌شود.</span></div><div class="family-topic-attachment-grid">${renderProfileDocumentSlot('medical', 'درمانی', canWrite, f.id)}${renderProfileDocumentSlot('education', 'آموزشی', canWrite, f.id)}${renderProfileDocumentSlot('financial', 'مالی', canWrite, f.id)}${renderProfileDocumentSlot('housing', 'مسکن', canWrite, f.id)}${renderProfileDocumentSlot('other', 'سایر', canWrite, f.id)}</div>`;
    $('#familyDetail').append(topical);
} const history = document.createElement('section'); history.className = 'detail-section followup-history'; history.innerHTML = `<div class="followup-history-head"><div><div class="eyebrow">مسیر ارتباط و اقدام</div><h3>پیگیری‌ها و یادداشت‌ها</h3><p>سوابق ثبت‌شده، موعدهای آینده و موارد عقب‌افتاده را مرور کنید.</p></div>${canWrite ? '<button class="primary" id="newNoteBtn">+ ثبت پیگیری جدید</button>' : ''}</div>${noteTimeline(f, canWrite)}`; $('#familyDetail').append(history); bindNoteTimeline(history, f); const nb = $('#newNoteBtn'); if (nb)
    nb.onclick = () => openFamilyFollowupForm(f); }

async function openFamilyFollowupForm(f) {
    let users = [], families = [];
    const canDelegate = actor?.role === 'admin' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy', 'finance_deputy'].includes(actor?.position);
    const isLiaison = actor?.position === 'liaison';
    try {
        const results = await Promise.all([canDelegate ? api('/api/assignees') : Promise.resolve({ users: [] }), f ? Promise.resolve(null) : loadActiveFamilyChoices()]);
        users = results[0].users || [];
        families = results[1] || [];
    }
    catch (e) {
        toast(e.message);
        return;
    }
    if (!f && !families.length)
        return toast('پروندهٔ فعالی برای ثبت پیگیری پیدا نشد.');
    const familyOptions = families.map(x => `<option value="${esc(x.id)}" data-family-name="${esc(x.headName || x.familySurname || 'خانواده')}" data-case-number="${esc(x.caseNumber || '—')}">${esc(x.headName || '')} · ${esc(x.familySurname || '')} · پرونده ${esc(x.caseNumber || '—')}</option>`).join('');
    const familyPicker = f ? '' : `<div class="form-field full followup-family-picker"><label for="followupFamilySelect">خانوادهٔ مرتبط <span class="required">*</span></label><input id="followupFamilySearch" type="search" placeholder="جست‌وجوی نام یا شماره پرونده"><select id="followupFamilySelect" name="familyId" required><option value="">انتخاب خانواده</option>${familyOptions}</select></div>`;
    const statusField = isLiaison ? `<div class="form-field full followup-policy-note">پیگیری به نام شما و با وضعیت «باز» ثبت می‌شود. وضعیت و مسئول را معاونان تعیین می‌کنند.</div>` : `<div class="form-field"><label>وضعیت پیگیری</label><select name="followUpStatus"><option>باز</option><option>در حال پیگیری</option><option>انجام شد</option><option>لغو شد</option></select></div>`;
    const assigneeField = canDelegate ? `<div class="form-field"><label>مسئول پیگیری</label><select name="assigneeId"><option value="">تعیین نشده</option>${users.map(u => `<option value="${esc(u.id)}" ${u.id === actor.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>` : `<div class="form-field followup-policy-note">مسئول پیگیری: شما</div>`;
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal" ${f ? `data-followup-family="${esc(f.headName)}" data-followup-case="${esc(f.caseNumber)}"` : ''}><div class="modal-head"><h2>ثبت پیگیری جدید</h2><button class="close-btn" data-close>×</button></div><form id="noteForm">${familyPicker}<div class="form-grid"><div class="form-field full"><label>نتیجه تماس یا شرح پیگیری</label><textarea name="text" required minlength="3" maxlength="1200" placeholder="نتیجه تماس یا اقدام انجام‌شده را بنویسید…"></textarea></div>${statusField}<div class="form-field"><label>تاریخ پیگیری بعدی</label><input name="nextFollowUpAt" type="datetime-local"></div>${assigneeField}<div class="form-field"><label>عنوان کوتاه پیگیری</label><input name="status" placeholder="مثلاً نیازمند تماس مجدد"></div></div><div id="noteError" class="message error"></div><div class="modal-actions"><button id="followupSubmit" class="primary" type="submit">ثبت پیگیری</button><button class="secondary" data-close type="button">انصراف</button></div></form></div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    const search = $('#followupFamilySearch'), select = $('#followupFamilySelect');
    if (search && select)
        search.oninput = () => { const q = search.value.trim().toLocaleLowerCase('fa'); [...select.options].slice(1).forEach(option => { option.hidden = Boolean(q) && !option.textContent.toLocaleLowerCase('fa').includes(q); }); };
    $('#noteForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget, fd = new FormData(form), targetFamily = f || families.find(x => x.id === String(fd.get('familyId') || ''));
        if (!form.reportValidity())
            return;
        if (!targetFamily) {
            $('#followupFamilySelect')?.reportValidity();
            return;
        }
        const date = String(fd.get('nextFollowUpAt') || ''), submit = $('#followupSubmit');
        submit.disabled = true;
        try {
            await api('/api/families/' + encodeURIComponent(targetFamily.id) + '/notes', { method: 'POST', body: JSON.stringify({ text: String(fd.get('text')), status: String(fd.get('status') || ''), followUpStatus: isLiaison ? 'باز' : String(fd.get('followUpStatus') || 'باز'), nextFollowUpAt: date ? new Date(date).toISOString() : null, assigneeId: canDelegate ? (String(fd.get('assigneeId') || '') || null) : actor.id }) });
            closeModal();
            toast('پیگیری جدید ثبت شد.');
            selectedId = targetFamily.id;
            await loadFamilies();
            await loadDetail(targetFamily.id);
        }
        catch (err) {
            submit.disabled = false;
            $('#noteError').textContent = err.message;
        }
    };
}

function bindProfileAttachmentActions(root, f) { root?.querySelectorAll('[data-profile-upload]').forEach(b => b.onclick = () => openDocumentForm(f, null, b.dataset.profileUpload, true)); root?.querySelectorAll('[data-profile-inline-edit]').forEach(b => b.onclick = () => openEditForm(f, b.dataset.profileInlineEdit)); }

async function loadProfileAttachments(f, canWrite) { const root = $('#familyDetail')?.querySelector('.full-profile') || $('#familyTopicAttachments'); if (!root)
    return; const slots = { medical: ['درمانی'], education: ['آموزشی'], housing: ['مسکن'], financial: ['مالی'], other: ['سایر', 'شناسایی'] }; try {
    const data = await api('/api/families/' + encodeURIComponent(f.id) + '/documents');
    if (selectedId !== f.id)
        return;
    Object.entries(slots).forEach(([slot, categories]) => { const host = root.querySelector(`[data-family-attachments="${slot}"] .profile-attachment-list`); if (!host)
        return; const docs = (data.documents || []).filter(d => categories.includes(d.category)); host.innerHTML = docs.map(d => `<article class="profile-attachment-item"><div class="profile-attachment-file"><span class="profile-attachment-file-icon" aria-hidden="true">▤</span><div><strong>${esc(d.fileName)}</strong><small>${esc(d.category)} · ${fa(Math.ceil(d.sizeBytes / 1024))} کیلوبایت${d.expiresAt ? ' · انقضا ' + esc(d.expiresAt) : ''}</small>${d.description ? `<span>${esc(d.description)}</span>` : ''}</div></div><div class="profile-attachment-actions"><button class="secondary" type="button" data-secure-download="/api/documents/${esc(d.id)}/download">دریافت</button>${canWrite ? `<button class="secondary" type="button" data-replace-doc="${esc(d.id)}" data-doc-category="${esc(d.category)}">جایگزینی</button><button class="danger" type="button" data-delete-doc="${esc(d.id)}">حذف</button>` : ''}</div></article>`).join('') || '<div class="profile-attachment-empty">هنوز پیوستی برای این بخش ثبت نشده است.</div>'; });
    root.querySelectorAll('[data-delete-doc]').forEach(b => b.onclick = async () => { const reason = prompt('دلیل حذف سند را وارد کنید:'); if (!reason || reason.trim().length < 3)
        return; try {
        await api('/api/documents/' + encodeURIComponent(b.dataset.deleteDoc), { method: 'DELETE', body: JSON.stringify({ reason: reason.trim() }) });
        toast('سند از این پرونده حذف شد.');
        loadProfileAttachments(f, canWrite);
    }
    catch (e) {
        toast(e.message);
    } });
    root.querySelectorAll('[data-replace-doc]').forEach(b => b.onclick = () => openDocumentForm(f, b.dataset.replaceDoc, b.dataset.docCategory));
}
catch (e) {
    root.querySelectorAll('.profile-attachment-list').forEach(x => x.innerHTML = '<div class="profile-attachment-empty">دریافت پیوست‌ها ممکن نشد.</div>');
} }

async function loadDocuments(f, canWrite) { const box = $('#documentsList'); try {
    const data = await api('/api/families/' + encodeURIComponent(f.id) + '/documents');
    box.innerHTML = data.documents.map(d => `<div class="doc-row"><div><b>${esc(d.fileName)}</b> ${d.sensitive ? '<span class="tag-sensitive">حساس</span>' : ''}<p>${esc(d.category)} · ${fa(Math.ceil(d.sizeBytes / 1024))} KB${d.expiresAt ? ' · انقضا: ' + esc(d.expiresAt) : ''}</p><small>${esc(d.description || '')}</small></div><div class="doc-actions"><button class="secondary" data-secure-download="/api/documents/${esc(d.id)}/download">دانلود امن</button>${canWrite ? `<button class="danger" data-delete-doc="${esc(d.id)}">حذف</button><button class="secondary" data-replace-doc="${esc(d.id)}">جایگزینی</button>` : ''}</div></div>`).join('') || '<div class="audit-empty">سندی بارگذاری نشده است.</div>';
    box.querySelectorAll('[data-delete-doc]').forEach(b => b.onclick = async () => { const reason = prompt('دلیل حذف سند را وارد کنید:'); if (!reason)
        return; await api('/api/documents/' + b.dataset.deleteDoc, { method: 'DELETE', body: JSON.stringify({ reason }) }); toast('سند به‌صورت کنترل‌شده حذف شد.'); loadDocuments(f, canWrite); });
    box.querySelectorAll('[data-replace-doc]').forEach(b => b.onclick = () => openDocumentForm(f, b.dataset.replaceDoc, b.dataset.docCategory));
}
catch (e) {
    box.innerHTML = '<div class="audit-empty">دریافت اسناد ناموفق بود.</div>';
} }

const fileBase64 = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });

function openDocumentForm(f, replaceId = null, defaultCategory = 'سایر', contextual = false) {
    const allowedCategories = ['شناسایی', 'درمانی', 'مالی', 'مسکن', 'آموزشی', 'سایر'];
    if (!allowedCategories.includes(defaultCategory))
        defaultCategory = 'سایر';
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>${replaceId ? 'جایگزینی کنترل‌شده' : 'بارگذاری سند'}</h2><button class="close-btn" data-close>×</button></div><form id="docForm"><div class="form-grid"><div class="form-field full"><label>فایل (حداکثر ۸ مگابایت)</label><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" required><small class="form-help">PDF یا JPG/PNG/WEBP، حداکثر ۸ مگابایت</small></div>${contextual ? `<input type="hidden" name="category" value="${esc(defaultCategory)}"><div class="form-field"><label>محل ثبت سند</label><div class="contextual-document-category">${esc(defaultCategory)} · این پیوست در همین بخش نگهداری می‌شود.</div></div>` : `<div class="form-field"><label>دسته‌بندی</label><select name="category"><option>شناسایی</option><option>درمانی</option><option>مالی</option><option>مسکن</option><option>آموزشی</option><option>سایر</option></select></div>`}<div class="form-field"><label>تاریخ انقضا</label><input name="expiresAt" type="date"></div><div class="form-field full"><label>توضیح</label><textarea name="description"></textarea></div><div class="form-field sensitive-file-field"><label class="checkbox-field"><input name="sensitive" type="checkbox"><span>فایل حساس</span></label></div>${replaceId ? '<div class="form-field"><label>دلیل جایگزینی</label><input name="reason" minlength="3" required></div>' : ''}</div><div id="docError" class="message error"></div><div class="modal-actions"><button class="primary" type="submit">ذخیره سند</button><button class="secondary" data-close type="button">انصراف</button></div></form></div></div>`);
    const docCategory = $('#docForm [name=category]');
    if (docCategory)
        docCategory.value = defaultCategory;
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    $('#docForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), file = fd.get('file'); if (!file || !file.size)
        return $('#docError').textContent = 'انتخاب فایل الزامی است.'; if (file.size > 8388608)
        return $('#docError').textContent = 'حجم فایل بیشتر از ۸ مگابایت است.'; const mimeByExt = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }, ext = (file.name.split('.').pop() || '').toLowerCase(), mimeType = file.type || mimeByExt[ext]; if (!mimeType || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType))
        return $('#docError').textContent = 'فرمت فایل مجاز نیست.'; const body = { fileName: file.name, mimeType, category: String(fd.get('category')), description: String(fd.get('description') || ''), expiresAt: String(fd.get('expiresAt') || '') || null, sensitive: fd.get('sensitive') === 'on', contentBase64: await fileBase64(file) }; if (replaceId)
        body.reason = String(fd.get('reason')); try {
        await api(replaceId ? '/api/documents/' + replaceId + '/replace' : '/api/families/' + f.id + '/documents', { method: 'POST', body: JSON.stringify(body) });
        closeModal();
        toast(replaceId ? 'سند جایگزین شد.' : 'سند بارگذاری شد.');
        loadDetail(f.id);
    }
    catch (err) {
        $('#docError').textContent = err.message;
    } };
}
