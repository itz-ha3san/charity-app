/* Feature: account-organization. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
function profileModal(title, body) { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="secondary" type="button" data-close>بازگشت</button></div>${body}</div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); }

function openMyProfile() { profileModal('پروفایل کاربری', `<form id="myProfileForm" data-no-autosave><div class="form-grid"><div class="form-field"><label>نام نمایشی</label><input name="displayName" value="${esc(actor.name)}" minlength="2" maxlength="100" required></div><div class="form-field"><label>نام کاربری</label><input name="username" dir="ltr" value="${esc(actor.username || '')}" minlength="3" maxlength="64" pattern="[A-Za-z0-9_.-]+" required></div><div class="form-field full"><label>رمز فعلی برای تأیید تغییرات</label><input name="currentPassword" type="password" autocomplete="current-password" required></div></div><div class="message error" aria-live="polite"></div><div class="modal-actions"><button class="primary" type="submit">ذخیره پروفایل</button><button class="secondary" type="button" id="myPasswordBtn">تغییر رمز عبور</button></div></form>`); $('#myPasswordBtn').onclick = openMyPassword; $('#myProfileForm').onsubmit = async (e) => { e.preventDefault(); const f = e.currentTarget; try {
    busy(f, true);
    await api('/auth/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    const me = await api('/auth/me');
    actor = me.user;
    window.currentActor = actor;
    $('#userName').textContent = actor.name;
    $('#avatar').textContent = actor.name.slice(0, 1);
    closeModal();
    toast('پروفایل ذخیره شد.');
}
catch (err) {
    message(f, err.message);
}
finally {
    busy(f, false);
} }; }

function openMyPassword() { profileModal('تغییر رمز عبور', `<p>رمز جدید حداقل ۱۲ نویسه و شامل حرف بزرگ، حرف کوچک و عدد باشد. پس از تغییر، همه نشست‌ها بسته می‌شوند.</p><form id="myPasswordForm" data-no-autosave><div class="form-field"><label>رمز فعلی</label><input name="currentPassword" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></div><div class="form-field"><label>رمز جدید</label><input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><div class="form-field"><label>تکرار رمز جدید</label><input name="confirmPassword" type="password" autocomplete="new-password" required></div><div class="message error" aria-live="polite"></div><button class="primary" type="submit">ثبت رمز جدید</button></form>`); $('#myPasswordForm').onsubmit = async (e) => { e.preventDefault(); const f = e.currentTarget, b = Object.fromEntries(new FormData(f)); if (b.newPassword !== b.confirmPassword)
    return message(f, 'تکرار رمز یکسان نیست.'); delete b.confirmPassword; try {
    busy(f, true);
    await api('/auth/change-password', { method: 'POST', body: JSON.stringify(b) });
    closeModal();
    actor = null;
    window.currentActor = null;
    showAuth(true);
    toast('رمز تغییر کرد؛ دوباره وارد شوید.');
}
catch (err) {
    message(f, err.message);
}
finally {
    busy(f, false);
} }; }

function openDonorForm() { profileModal('حامی جدید', `<form id="donorForm"><div class="form-grid"><div class="form-field"><label>نام حامی</label><input name="name" required minlength="2" maxlength="150"></div><div class="form-field"><label>نوع حامی</label><select name="donorType"><option value="individual">شخص حقیقی</option><option value="organization">سازمان</option></select></div><div class="form-field"><label>تلفن</label><input name="phone" inputmode="tel" maxlength="11" pattern="0[0-9]{10}" placeholder="۰۹۱۲۳۴۵۶۷۸۹"></div><div class="form-field"><label>ایمیل</label><input name="email" type="email"></div><div class="form-field full"><label>توضیحات</label><textarea name="notes" maxlength="2000"></textarea></div></div><div class="message error" aria-live="polite"></div><button type="submit" class="primary">ثبت حامی</button></form>`); $('#donorForm').onsubmit = async (e) => { e.preventDefault(); const f = e.currentTarget; try {
    busy(f, true);
    await api('/api/donors', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    toast('حامی ثبت شد.');
    openFutureCenter();
}
catch (err) {
    message(f, err.message);
}
finally {
    busy(f, false);
} }; }

async function supervisorOptions() { const d = await api('/api/organization/overview'); return d.supervisors.filter(x => x.active); }

function familyFilterGroup() { return $('.family-list-filters .family-filter-selectors'); }

function syncFamilyFilterVisibility() { const panel = $('.family-list-filters'), group = familyFilterGroup(); if (panel)
    panel.hidden = !group?.children.length; }

async function refreshSupervisorFilter() { const allowed = Boolean(actor && (['admin', 'caseworker'].includes(actor.role) || ['ceo', 'supervision_deputy'].includes(actor.position))); if (!allowed) {
    $('#supervisorFilter')?.closest('.form-field')?.remove();
    syncFamilyFilterVisibility();
    return;
} const group = familyFilterGroup(); let select = $('#supervisorFilter'); if (!select) {
    const box = document.createElement('div');
    box.className = 'form-field supervisor-filter';
    box.innerHTML = '<label for="supervisorFilter">سرپرست خانواده</label><select id="supervisorFilter"><option value="">همه سرپرست‌ها</option></select>';
    group.append(box);
    select = box.querySelector('select');
    select.onchange = () => { selectedId = null; loadFamilies(); };
}
else if (!select.closest('.family-filter-selectors'))
    group.append(select.closest('.form-field')); try {
    const rows = await supervisorOptions(), old = select.value;
    select.innerHTML = '<option value="">همه سرپرست‌ها</option>' + rows.map(x => `<option value="${x.id}">${esc(x.name)} (${fa(x.familyCount)} خانواده)</option>`).join('');
    select.value = old;
}
catch (err) {
    select.closest('.form-field').remove();
} syncFamilyFilterVisibility(); }

async function refreshLiaisonFilter() { const allowed = Boolean(actor && (actor.role === 'admin' || actor.role === 'accountant' || ['ceo', 'supervision_deputy', 'health_deputy', 'education_deputy'].includes(actor.position))); if (!allowed) {
    $('#liaisonFilter')?.closest('.form-field')?.remove();
    syncFamilyFilterVisibility();
    return;
} const group = familyFilterGroup(); let select = $('#liaisonFilter'); if (!select) {
    const box = document.createElement('div');
    box.className = 'form-field liaison-filter';
    box.innerHTML = '<label for="liaisonFilter">رابط خیریه</label><select id="liaisonFilter"><option value="">همه رابط‌ها</option></select>';
    group.append(box);
    select = box.querySelector('select');
    select.onchange = () => { selectedId = null; loadFamilies(); };
}
else if (!select.closest('.family-filter-selectors'))
    group.append(select.closest('.form-field')); try {
    const data = await api('/api/assignees'), rows = (data.users || []).filter(x => x.position === 'liaison'), old = select.value;
    select.innerHTML = '<option value="">همه رابط‌ها</option>' + rows.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    select.value = rows.some(x => x.id === old) ? old : '';
}
catch (err) {
    select.closest('.form-field').remove();
} syncFamilyFilterVisibility(); }

async function setSupervisorFilter(id) { await refreshSupervisorFilter(); const s = $('#supervisorFilter'); if (s)
    s.value = id; }

async function mountSupervisorSelect(form, selected) { const grid = form.querySelector('.form-grid'); const field = document.createElement('div'); field.className = 'form-field'; field.innerHTML = '<label>سرپرست ارتباط خانواده</label><select name="supervisorId" disabled><option value="">در حال دریافت…</option></select><small class="form-help">این فرد پل ارتباطی خیریه با خانواده است و با فرد اصلی خانوار (که ممکن است والد نباشد) تفاوت دارد. انتخاب خالی یعنی در انتظار تعیین سرپرست ارتباط خانواده.</small>'; grid.append(field); const select = field.querySelector('select'); form.addEventListener('submit', e => { if (select.disabled) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const box = form.querySelector('#createError');
    if (box)
        box.textContent = 'ابتدا باید فهرست سرپرست‌ها دریافت شود؛ فرم را دوباره باز کنید.';
} }, true); try {
    const rows = await supervisorOptions();
    if (!form.isConnected)
        return;
    select.innerHTML = '<option value="">در انتظار تعیین سرپرست</option>' + rows.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    if (selected && !rows.some(x => x.id === selected)) {
        select.innerHTML += `<option value="${esc(selected)}">سرپرست فعلی (خارج از فهرست فعال)</option>`;
    }
    select.value = selected || '';
    select.disabled = false;
}
catch (err) {
    if (form.isConnected) {
        select.innerHTML = '<option value="">دریافت فهرست ناموفق؛ دوباره فرم را باز کنید</option>';
        field.querySelector('small').textContent = err.message;
    }
} }

function openDeleteSupervisor(supervisor, data) { const choices = data.supervisors.filter(x => x.active && x.id !== supervisor.id); profileModal('حذف سرپرست', `<p>سرپرست «${esc(supervisor.name)}» دارای ${fa(supervisor.familyCount)} خانواده است. خانواده‌ها بدون انتخاب صریح شما حذف نمی‌شوند.</p><form id="deleteSupervisorForm"><div class="form-field"><label>تکلیف خانواده‌ها</label><select name="mode"><option value="pending">حفظ خانواده‌ها و انتظار برای سرپرست جدید</option><option value="transfer">انتقال به سرپرست دیگر</option><option value="delete_families">حذف قطعی خانواده‌های این سرپرست</option></select></div><div class="form-field" id="replacementField" hidden><label>سرپرست جایگزین</label><select name="replacementId"><option value="">انتخاب کنید</option>${choices.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><p id="deleteFamilyWarning" hidden class="message error">حذف خانواده‌ها و سوابق وابسته قابل بازگشت نیست. خانواده‌های دارای سابقه تخصیص کمک یا گردش انبار برای حفظ دفتر مالی قابل حذف نیستند.</p><div class="message error" data-delete-error aria-live="polite"></div><button class="danger" type="submit">تأیید حذف سرپرست</button></form>`); const f = $('#deleteSupervisorForm'); f.elements.mode.onchange = () => { $('#replacementField').hidden = f.elements.mode.value !== 'transfer'; f.elements.replacementId.required = f.elements.mode.value === 'transfer'; $('#deleteFamilyWarning').hidden = f.elements.mode.value !== 'delete_families'; }; f.onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (b.mode !== 'transfer')
    delete b.replacementId; if (b.mode === 'delete_families') {
    const ok = await confirmDanger('حذف قطعی خانواده‌ها', 'همه خانواده‌های متصل به این سرپرست و سوابق وابسته حذف می‌شوند. آیا مطمئن هستید؟', 'حذف قطعی خانواده‌ها');
    if (!ok)
        return;
    b.confirmDelete = true;
} try {
    f.querySelector('button[type=submit]').disabled = true;
    await api('/api/supervisors/' + supervisor.id, { method: 'DELETE', body: JSON.stringify(b) });
    toast('سرپرست حذف شد و تکلیف خانواده‌ها ثبت شد.');
    await refreshSupervisorFilter();
    loadFamilies();
    openOrganization();
}
catch (err) {
    f.querySelector('[data-delete-error]').textContent = err.data?.error === 'FAMILIES_HAVE_LEDGER_HISTORY' ? 'این خانواده‌ها سابقه مالی یا انبار دارند؛ انتقال یا انتظار را انتخاب کنید.' : err.message;
}
finally {
    f.querySelector('button[type=submit]').disabled = false;
} }; }

let familySearchTimer;
