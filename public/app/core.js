/* Feature: core. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const $ = s => document.querySelector(s), positionNames = { liaison: 'رابط', education_deputy: 'معاون آموزشی', supervision_deputy: 'معاون سرپرستی', health_deputy: 'معاون بهداشت', finance_deputy: 'معاون مالی', ceo: 'معاون کل', education_officer: 'معاون آموزشی', health_officer: 'معاون بهداشت', finance_officer: 'معاون مالی' }, esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), fa = v => new Intl.NumberFormat('fa-IR').format(v ?? 0), money = v => new Intl.NumberFormat('fa-IR').format(BigInt(String(v ?? 0)));

/* ✔ اصلاح ۱: افزودن editingFamilyCache */
let actor = null, selectedId = null, importPayload = null, editingFamilyCache = null;

function getFamilyRouteId() { const match = location.hash.match(/^#\/families\/([^/?#]+)/); if (!match)
    return null; try {
    return decodeURIComponent(match[1]);
}
catch {
    return null;
} }

async function openFamilyRecord(id, { updateUrl = true, scroll = true } = {}) { if (!id)
    return; const route = '#/families/' + encodeURIComponent(id); if (updateUrl && location.hash !== route)
    history.pushState({ familyId: id }, '', route); selectedId = id; closeModal(); await loadDetail(id); if (scroll)
    $('#familyDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function busy(form,on){return AppUI.busy(form,on);}
function message(form,text,type='error'){return AppUI.message(form,text,type);}
function toast(text){return AppUI.toast(text);}

function showAuth(bootstrapped = true) { window.CaseWizard?.clearSession(); window.CaseDraftStore?.clearSession(); actor = null; window.currentActor = null; selectedId = null; editingFamilyCache = null; importPayload = null; AppUI.mountModal(''); $('#familyDetail').innerHTML = ''; $('#familyList').innerHTML = ''; $('#loading').classList.add('hidden'); document.querySelector('.topbar-actions .user-card')?.classList.add('hidden'); $('#dashboard').classList.add('hidden'); $('#auth').classList.remove('hidden'); $('#loginForm').classList.toggle('hidden', !bootstrapped); $('#bootstrapForm').classList.toggle('hidden', bootstrapped); setTimeout(() => $(bootstrapped ? '#loginUsername' : '#displayName').focus(), 20); }

function showDashboard(user) { actor = user; window.currentActor = user; $('#loading').classList.add('hidden'); $('#auth').classList.add('hidden'); $('#dashboard').classList.remove('hidden'); $('#userName').textContent = user.name; $('#userRole').textContent = positionNames[user.position] || 'سمت تعریف نشده'; $('#avatar').textContent = (user.name || '؟').slice(0, 1); const userCard = $('.topbar-actions .user-card') || $('#dashboard .user-card'), topbarActions = $('.topbar-actions'); if (userCard && topbarActions) {
    userCard.classList.remove('hidden');
    topbarActions.prepend(userCard);
} const canCreateFamily = user.role === 'admin' || user.position === 'supervision_deputy'; $('#importBtn').classList.toggle('hidden', !canCreateFamily); $('#createBtn').classList.toggle('hidden', !canCreateFamily); $('#quickOccasionalBtn')?.classList.toggle('hidden', !['admin', 'caseworker'].includes(user.role)); $('#quickCallBtn')?.classList.toggle('hidden', !['admin', 'caseworker'].includes(user.role)); const canManageSupervisors = user.role === 'admin' || ['ceo', 'supervision_deputy'].includes(user.position); $('#organizationBtn').classList.toggle('hidden', !canManageSupervisors); setupOpsNav(); refreshSupervisorFilter(); refreshLiaisonFilter(); if (user.mustChangePassword)
    return openForcedPasswordChange(); selectedId = getFamilyRouteId(); loadFamilies(); }

async function init() { const bootTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('BOOT_TIMEOUT')), 5000)); try {
    const status = await Promise.race([api('/auth/status'), bootTimeout]);
    if (!status.bootstrapped)
        return showAuth(false);
    try {
        const me = await Promise.race([api('/auth/me'), bootTimeout]);
        showDashboard(me.user);
    }
    catch (e) {
        showAuth(true);
        if (e?.message === 'BOOT_TIMEOUT')
            message($('#loginForm'), 'پاسخ سامانه طول کشید. لطفاً دوباره تلاش کنید.');
    }
}
catch (e) {
    showAuth(true);
    message($('#loginForm'), e?.message === 'BOOT_TIMEOUT' ? 'پاسخ سامانه طول کشید. لطفاً دوباره تلاش کنید.' : 'اتصال به سامانه برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.');
} }

function openForcedPasswordChange() { AppUI.mountModal(`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>تغییر اجباری رمز عبور</h2></div><p class="muted">رمز موقت باید پیش از ادامه تغییر کند. رمز جدید حداقل ۱۲ نویسه و شامل حرف بزرگ، حرف کوچک و عدد باشد.</p><form id="forcedPasswordForm"><div class="form-field"><label>رمز فعلی</label><input name="currentPassword" type="password" required minlength="8"></div><div class="form-field"><label>رمز جدید</label><input name="newPassword" type="password" required minlength="12"></div><div class="message error"></div><button class="primary" type="submit">تغییر رمز و ورود مجدد</button></form></div></div>`); $('#forcedPasswordForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); try {
    await api('/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
    actor = null;
    closeModal();
    showAuth(true);
    message($('#loginForm'), 'رمز تغییر کرد؛ دوباره وارد شوید.', 'success');
}
catch (err) {
    message(e.currentTarget, err.message);
} }; }

async function secureDownload(url) { const reason = prompt('دلیل دسترسی به این اطلاعات حساس را وارد کنید:'); if (!reason || reason.trim().length < 3)
    return; const res = await fetch(url, { credentials: 'include', headers: { 'x-access-reason': reason.trim() } }); if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return toast(d.error === 'ACCESS_REASON_REQUIRED' ? 'ثبت دلیل دسترسی الزامی است.' : 'دانلود مجاز نیست.');
} const blob = await res.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'document'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
