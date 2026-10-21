/* Feature: organization. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
async function loadFamilyTeam(f) { const contactStrip = $('#familyContactStrip'); try {
    const d = await api('/api/families/' + f.id + '/team'), assignment = d.assignment || {}, canAssignSupervisor = actor?.role === 'admin' || ['ceo', 'supervision_deputy'].includes(actor?.position), canRefer = actor?.role === 'admin' || ['ceo', 'supervision_deputy'].includes(actor?.position);
    // Team actions can live in the hero toolbar after enhancement. Retire
    // previous controls before binding the newly rendered permission-aware set.
    contactStrip?.closest('#familyDetail')?.querySelectorAll('.family-action-buttons #assignSupervisorBtn, .family-action-buttons #referFamilyBtn').forEach(button => button.remove());
    if (contactStrip)
        contactStrip.innerHTML = `<div class="family-contact-item" data-contact="liaison"><span>رابط خیریه</span><b>${esc(assignment.liaisonName || 'تعیین نشده')}</b></div><div class="family-contact-item" data-contact="supervisor"><span>سرپرست ارتباط خانواده</span><b>${esc(assignment.supervisorName || 'تعیین نشده')}</b></div>${canAssignSupervisor || canRefer ? `<div class="family-contact-actions">${canAssignSupervisor ? '<button id="assignSupervisorBtn" class="secondary" type="button">تخصیص سرپرست</button>' : ''}${canRefer ? '<button id="referFamilyBtn" class="secondary" type="button">ارجاع به کارشناس</button>' : ''}</div>` : ''}`;
    const profile = $('#familyDetail .full-profile');
    [['liaisonName', assignment.liaisonName], ['supervisorName', assignment.supervisorName]].forEach(([key, value]) => { const field = profile?.querySelector(`[data-profile-key="${key}"]`); if (!field)
        return; field.classList.toggle('is-empty', !value); const target = field.querySelector('.profile-ei-value,.profile-empty-value'); if (target)
        target.outerHTML = value ? `<span class="profile-ei-value">${esc(value)}</span>` : '<span class="profile-empty-value">تعیین نشده</span>'; });
    const assign = contactStrip?.querySelector('#assignSupervisorBtn'), refer = contactStrip?.querySelector('#referFamilyBtn');
    if (assign)
        assign.onclick = () => assignSupervisor(f);
    if (refer)
        refer.onclick = () => referFamily(f);
    window.dispatchEvent(new CustomEvent('familyteamloaded', { detail: { family: f } }));
}
catch (e) {
    if (contactStrip) {
        if (e.status === 403) {
            contactStrip.closest('#familyDetail')?.querySelectorAll('.family-action-buttons #assignSupervisorBtn, .family-action-buttons #referFamilyBtn').forEach(button => button.remove());
            contactStrip.remove();
        }
        else
            contactStrip.querySelectorAll('b').forEach(x => x.textContent = 'دریافت نشد');
    }
} }

async function assignSupervisor(f) {
    let overview, currentTeam = { assignment: null };
    try {
        [overview, currentTeam] = await Promise.all([
            api('/api/organization/overview'),
            api('/api/families/' + encodeURIComponent(f.id) + '/team').catch(() => ({ assignment: null }))
        ]);
    }
    catch (err) {
        toast(err.message || 'دریافت فهرست سرپرست‌ها ناموفق بود.');
        return;
    }
    const active = (overview.supervisors || []).filter(x => x.active);
    if (!active.length)
        return toast('سرپرست فعالی برای انتخاب وجود ندارد؛ ابتدا در مدیریت ارتباط خانواده، سرپرست بسازید.');
    const current = currentTeam.assignment || null, currentId = current?.supervisorId || '';
    const options = active.map(x => `<label class="supervisor-choice" data-supervisor-option data-search="${esc((x.name || '') + ' ' + (x.liaisonName || ''))}"><input type="radio" name="supervisorId" value="${esc(x.id)}" ${x.id === currentId ? 'checked' : ''}><span class="supervisor-choice-card"><span class="supervisor-choice-avatar" aria-hidden="true">${esc((x.name || 'س').trim().slice(0, 1))}</span><span class="supervisor-choice-copy"><b>${esc(x.name)}</b><small>رابط خیریه: ${esc(x.liaisonName || 'تعیین نشده')}</small></span><span class="supervisor-choice-meta">${fa(x.familyCount || 0)} خانواده</span><span class="supervisor-choice-check" aria-hidden="true">✓</span></span></label>`).join('');
    const familyLabel = [f.caseNumber ? 'پرونده ' + f.caseNumber : '', f.familySurname || ''].filter(Boolean).join(' · ');
    AppUI.mountModal(`<div class="modal-backdrop supervisor-assignment-backdrop"><section class="modal supervisor-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="supervisorAssignmentTitle" aria-describedby="supervisorAssignmentDescription"><header class="supervisor-assignment-head"><span class="supervisor-assignment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6"/></svg></span><div class="supervisor-assignment-title"><span class="eyebrow">مدیریت ارتباط خانواده</span><h2 id="supervisorAssignmentTitle">انتخاب سرپرست ارتباط خانواده</h2><p id="supervisorAssignmentDescription">سرپرست، پل ارتباطی خیریه با خانواده است؛ این عنوان به معنی والد خانواده نیست.</p></div><button class="close-btn" type="button" data-close aria-label="بستن پنجره">×</button></header><div class="supervisor-assignment-body"><div class="supervisor-family-context"><span class="supervisor-context-label">پروندهٔ انتخاب‌شده</span><b>${esc(f.headName || f.familySurname || 'خانواده')}</b><small>${esc(familyLabel || 'پرونده خانواده')}</small></div><div class="supervisor-assignment-current" ${current ? '' : 'hidden'}><span class="supervisor-current-dot" aria-hidden="true"></span><span>سرپرست فعلی: <b>${esc(current?.supervisorName || '')}</b></span></div><div class="supervisor-choice-heading"><div><h3>سرپرست موردنظر</h3><p>یک نفر را انتخاب کنید تا به این پرونده متصل شود.</p></div><span class="count-chip">${fa(active.length)} نفر فعال</span></div><label class="supervisor-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg><input id="supervisorChoiceSearch" type="search" autocomplete="off" placeholder="جست‌وجو بر اساس نام سرپرست یا رابط خیریه" aria-label="جست‌وجوی سرپرست‌ها"></label><form id="supervisorAssignmentForm"><div class="supervisor-choice-list" id="supervisorChoiceList">${options}<div id="supervisorChoiceEmpty" class="supervisor-choice-empty" hidden>سرپرستی با این عبارت پیدا نشد.</div></div><div class="supervisor-assignment-error" id="supervisorAssignmentError" aria-live="polite"></div><footer class="supervisor-assignment-footer"><span id="supervisorSelectedText" class="supervisor-selected-text">برای ادامه یک سرپرست انتخاب کنید.</span><div class="supervisor-assignment-actions"><button class="secondary" type="button" data-close>انصراف</button><button class="primary" id="saveSupervisorAssignment" type="submit" disabled>تخصیص به پرونده</button></div></footer></form></div></section></div>`);
    const root = $('#modalRoot'), backdrop = root.querySelector('.supervisor-assignment-backdrop'), form = $('#supervisorAssignmentForm'), search = $('#supervisorChoiceSearch'), submit = $('#saveSupervisorAssignment'), selectedText = $('#supervisorSelectedText');
    let closeOnEscape;
    const closeSupervisorDialog = () => { if (closeOnEscape)
        document.removeEventListener('keydown', closeOnEscape); closeModal(); };
    root.querySelectorAll('[data-close]').forEach(btn => btn.onclick = closeSupervisorDialog);
    closeOnEscape = e => { if (e.key === 'Escape')
        closeSupervisorDialog(); };
    document.addEventListener('keydown', closeOnEscape);
    backdrop.addEventListener('click', e => { if (e.target === backdrop)
        closeSupervisorDialog(); });
    function syncSupervisorChoice() { const chosen = form.querySelector('input[name="supervisorId"]:checked'), item = chosen?.closest('[data-supervisor-option]'); root.querySelectorAll('[data-supervisor-option]').forEach(x => x.classList.toggle('is-selected', x === item)); if (chosen) {
        const name = active.find(x => x.id === chosen.value)?.name || 'سرپرست';
        selectedText.textContent = chosen.value === currentId ? 'این سرپرست هم‌اکنون مسئول پرونده است.' : 'انتخاب‌شده: ' + name;
        submit.textContent = chosen.value === currentId ? 'سرپرست فعلی است' : 'تخصیص به پرونده';
        submit.disabled = chosen.value === currentId;
    }
    else {
        selectedText.textContent = 'برای ادامه یک سرپرست انتخاب کنید.';
        submit.textContent = 'تخصیص به پرونده';
        submit.disabled = true;
    } }
    form.querySelectorAll('input[name="supervisorId"]').forEach(input => input.addEventListener('change', syncSupervisorChoice));
    syncSupervisorChoice();
    search.addEventListener('input', () => { const q = search.value.trim().toLocaleLowerCase('fa'); let shown = 0; root.querySelectorAll('[data-supervisor-option]').forEach(item => { const match = item.dataset.search.toLocaleLowerCase('fa').includes(q); item.hidden = !match; if (!match && item.querySelector('input')?.checked)
        item.querySelector('input').checked = false; if (match)
        shown++; }); syncSupervisorChoice(); $('#supervisorChoiceEmpty').hidden = shown > 0; });
    form.onsubmit = async (e) => { e.preventDefault(); const supervisorId = form.querySelector('input[name="supervisorId"]:checked')?.value; if (!supervisorId)
        return $('#supervisorAssignmentError').textContent = 'یک سرپرست را انتخاب کنید.'; submit.disabled = true; submit.classList.add('button-loading'); $('#supervisorAssignmentError').textContent = ''; try {
        await api('/api/families/' + encodeURIComponent(f.id) + '/supervisor', { method: 'POST', body: JSON.stringify({ supervisorId, reason: 'تخصیص از پرونده' }) });
        closeSupervisorDialog();
        toast('سرپرست ارتباط خانواده ثبت شد.');
        loadFamilyTeam(f);
    }
    catch (err) {
        $('#supervisorAssignmentError').textContent = err.message || 'ثبت تخصیص ناموفق بود.';
        submit.disabled = false;
        submit.classList.remove('button-loading');
    } };
    search.focus();
}

async function referFamily(f) {
    try {
        const d = await api('/api/organization/overview');
        const healthUsers = d.users.filter(x => ['health_deputy', 'health_officer'].includes(x.position) && x.active);
        const educationUsers = d.users.filter(x => ['education_deputy', 'education_officer'].includes(x.position) && x.active);
        AppUI.mountModal(`<div class="modal-backdrop"><div class="modal referral-modal" role="dialog" aria-modal="true" aria-labelledby="referralTitle"><div class="modal-head"><div><div class="eyebrow">پیگیری تخصصی خانواده</div><h2 id="referralTitle">ارجاع به کارشناس</h2></div><button class="close-btn" type="button" data-close aria-label="بستن">×</button></div><div class="referral-explainer"><span class="referral-explainer-icon" aria-hidden="true">↗</span><p><b>این ارجاع چه کاری می‌کند؟</b><span>پرونده برای بررسی و پیگیری تخصصی به یکی از کارشناسان فعالِ درمان یا آموزش ارسال می‌شود. این کار سرپرست ارتباط خانواده را تغییر نمی‌دهد.</span></p></div><form id="referralForm"><div class="referral-form-grid"><label>حوزه پیگیری<select id="referralDomain" name="domain"><option value="health">بهداشت و درمان</option><option value="education">آموزش و تحصیل</option></select></label><label>کارشناس مسئول<select id="referralAssignee" name="assignedTo"></select></label></div><p id="referralAssigneeHint" class="referral-form-hint"></p><label class="referral-reason-label">موضوع و دلیل ارجاع<textarea name="reason" required minlength="3" maxlength="2000" placeholder="نیاز خانواده و نوع پیگیری مورد انتظار را توضیح دهید…"></textarea></label><div id="referralError" class="message error" aria-live="polite"></div><div class="modal-actions"><button id="submitReferral" class="primary" type="submit">ثبت ارجاع</button><button class="secondary" type="button" data-close>انصراف</button></div></form></div></div>`);
        document.querySelectorAll('#modalRoot [data-close]').forEach(b => b.onclick = closeModal);
        const form = $('#referralForm'), select = $('#referralAssignee'), submit = $('#submitReferral'), hint = $('#referralAssigneeHint');
        const updateAssignees = () => {
            const domain = form.elements.domain.value, users = domain === 'health' ? healthUsers : educationUsers;
            select.innerHTML = users.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
            select.disabled = !users.length;
            submit.disabled = !users.length;
            hint.textContent = users.length ? `${fa(users.length)} کارشناس فعال در این حوزه` : 'برای این حوزه کارشناس فعالی ثبت نشده است؛ پس از ثبت کارشناس می‌توانید ارجاع دهید.';
        };
        $('#referralDomain').onchange = updateAssignees;
        updateAssignees();
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (!form.reportValidity() || !select.value)
                return;
            const body = { domain: form.elements.domain.value, assignedTo: select.value, reason: String(form.elements.reason.value || '').trim() };
            submit.disabled = true;
            submit.classList.add('button-loading');
            try {
                await api('/api/families/' + f.id + '/referrals', { method: 'POST', body: JSON.stringify(body) });
                closeModal();
                toast('ارجاع برای کارشناس ثبت شد.');
                await loadFamilyTeam(f);
            }
            catch (err) {
                $('#referralError').textContent = err.message;
                submit.disabled = false;
                submit.classList.remove('button-loading');
            }
        };
    }
    catch (e) {
        toast(e.message);
    }
}

async function openOrganization() {
    try {
        const d = await api('/api/organization/overview'), canManage = actor?.role === 'admin' || ['ceo', 'supervision_deputy'].includes(actor?.position);
        AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><h2>فهرست سرپرست‌های ارتباط خانواده</h2><button data-close class="secondary">بازگشت</button></div>${canManage ? '<button id="newSupervisorBtn" class="primary">سرپرست ارتباط خانواده جدید</button>' : ''}<div class="form-field"><label>جست‌وجوی سرپرست ارتباط خانواده (نام، تلفن، کد ملی)</label><input id="supervisorSearch"></div><div id="supervisorRows"></div></div></div>`);
        const render = () => {
            const term = $('#supervisorSearch').value.trim();
            $('#supervisorRows').innerHTML = d.supervisors.filter(x => [x.name, x.phone, x.nationalId].some(v => String(v || '').includes(term))).map(x => `<div class="user-row"><div><b>${esc(x.name)}</b><p>رابط خیریه: ${esc(x.liaisonName)} · ${fa(x.familyCount)} خانواده · ${x.active ? 'فعال' : 'حذف‌شده'}</p><p>تلفن: ${esc(x.phone || '—')} · کد ملی: ${esc(x.nationalId || '—')}</p><p>${esc(x.notes || '')}</p></div><div class="doc-actions"><button class="secondary" data-supervisor-families="${x.id}">خانواده‌ها</button>${canManage && x.active ? `<button class="danger" data-supervisor-delete="${x.id}">حذف سرپرست</button>` : ''}</div></div>`).join('') || '<p>سرپرستی پیدا نشد.</p>';
            $('#supervisorRows').querySelectorAll('[data-supervisor-families]').forEach(b => b.onclick = async () => { closeModal(); await setSupervisorFilter(b.dataset.supervisorFamilies); selectedId = null; $('#statusFilter').value = 'all'; $('#statusFilter').dispatchEvent(new Event('change', { bubbles: true })); });
            $('#supervisorRows').querySelectorAll('[data-supervisor-delete]').forEach(b => b.onclick = () => openDeleteSupervisor(d.supervisors.find(x => x.id === b.dataset.supervisorDelete), d));
        };
        $('#supervisorSearch').oninput = render;
        render();
        document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
        if ($('#newSupervisorBtn'))
            $('#newSupervisorBtn').onclick = () => openSupervisorForm(d);
    }
    catch (e) {
        toast(e.message);
    }
}

function openSupervisorForm(d) { const liaisons = d.users.filter(x => x.position === 'liaison' && x.active); if (!liaisons.length)
    return toast('ابتدا یک کاربر با سمت رابط ایجاد کنید.'); AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>سرپرست ارتباط خانواده جدید</h2><button class="close-btn" data-close>×</button></div><form id="supervisorForm"><div class="form-grid"><div class="form-field"><label>نام</label><input name="name" required></div><div class="form-field"><label>کد ملی</label><input name="nationalId" maxlength="10"></div><div class="form-field"><label>تلفن</label><input name="phone"></div><div class="form-field"><label>رابط خیریه</label><select name="liaisonId">${liaisons.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="form-field full"><label>یادداشت</label><textarea name="notes"></textarea></div></div><div class="modal-actions"><button class="primary">ثبت</button></div></form></div></div>`); document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal); $('#supervisorForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), body = Object.fromEntries(fd); if (!body.nationalId)
    body.nationalId = null; try {
    await api('/api/supervisors', { method: 'POST', body: JSON.stringify(body) });
    await refreshSupervisorFilter();
    openOrganization();
}
catch (err) {
    toast(err.message);
} }; }
