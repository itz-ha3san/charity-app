AppAssets.register('admin',['openTrainingCenter','openOpsStatus','openUatCenter','openMigrationCenter','openSecurityCenter','openUserRegistry','openUsers','openUserAudit','openCreateUser','openSessions','openPublicSupportForm','trackPublicSupport','openFutureCenter','confirmDanger']);
AppAssets.register('approval',['openApprovalQueue']);
/* Only this entry binds application events and starts the session. */
window.addEventListener('popstate', () => { if (!actor)
    return; const id = getFamilyRouteId(); if (id) {
    openFamilyRecord(id, { updateUrl: false });
    return;
} selectedId = null; loadFamilies(); });

document.addEventListener('click', event => { const target = event.target.closest('[data-c7-family],[data-overview-family],[data-attention-family],[data-advanced-family],[data-open-family],[data-fin-family],[data-specialist-family],[data-action-family],.overdue-link[data-family],.family-item[data-id]'); if (!target)
    return; const id = target.dataset.c7Family || target.dataset.overviewFamily || target.dataset.attentionFamily || target.dataset.advancedFamily || target.dataset.openFamily || target.dataset.finFamily || target.dataset.specialistFamily || target.dataset.actionFamily || target.dataset.family || target.dataset.id; if (!id)
    return; event.preventDefault(); event.stopImmediatePropagation(); openFamilyRecord(id); }, { capture: true });



window.addEventListener('sessionexpired', () => { actor = null; selectedId = null; $('#loginPassword').value = ''; showAuth(true); message($('#loginForm'), 'نشست شما منقضی شده است؛ دوباره وارد شوید.', 'error'); });

$('#loginForm').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.currentTarget; busy(form, true); message(form, 'در حال بررسی…', ''); try {
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: $('#loginUsername').value.trim(), password: $('#loginPassword').value }) });
    const me = await api('/auth/me');
    showDashboard(me.user);
}
catch (err) {
    message(form, err.message);
}
finally {
    busy(form, false);
} });

$('#bootstrapForm').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.currentTarget, p = $('#bootstrapPassword').value; if (p !== $('#bootstrapPassword2').value)
    return message(form, 'تکرار رمز یکسان نیست.'); busy(form, true); try {
    await api('/auth/bootstrap', { method: 'POST', body: JSON.stringify({ displayName: $('#displayName').value.trim(), username: $('#bootstrapUsername').value.trim(), password: p, installSecret: $('#bootstrapSecret').value }) });
    const me = await api('/auth/me');
    showDashboard(me.user);
}
catch (err) {
    message(form, err.message);
}
finally {
    busy(form, false);
} });

$('#organizationBtn').addEventListener('click', openOrganization);

$('#editProfileBtn').addEventListener('click', openMyProfile);

$('#logoutBtn').addEventListener('click', async () => { window.CaseWizard?.clearSession(); window.CaseDraftStore?.clearSession(); const btn = $('#logoutBtn'); btn.disabled = true; try {
    await api('/auth/logout', { method: 'POST', body: '{}' });
}
catch { }
finally {
    btn.disabled = false;
    actor = null;
    selectedId = null;
    $('#loginPassword').value = '';
    showAuth(true);
} });

document.addEventListener('click', e => { const b = e.target.closest('[data-secure-download]'); if (b) {
    e.preventDefault();
    secureDownload(b.dataset.secureDownload);
} });

window.addEventListener('familymissingfield', e => openFamilyMissingField(e.detail));

window.openLiaisonMessageComposer = openLiaisonMessageComposer;

window.openActiveFamilyList = openActiveFamilyList;

window.openUrgentFamilyList = openUrgentFamilyList;

window.openAttentionItems = openAttentionItems;

if ('serviceWorker' in navigator)
    window.addEventListener('load', async () => { const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname), privateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(location.hostname); if (local || privateIp) {
        for (const r of await navigator.serviceWorker.getRegistrations())
            await r.unregister();
        if ('caches' in window)
            for (const k of await caches.keys())
                await caches.delete(k);
    }
    else
        navigator.serviceWorker.register('/sw.js').catch(() => { }); });

document.addEventListener('input', e => { const el = e.target; if (!(el instanceof HTMLInputElement) || el.dataset.persianKind || el.closest('#createFamilyForm'))
    return; if (['phone', 'nationalId'].includes(el.name)) {
    const next = el.value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (el.value !== next)
        el.value = next;
} });

$('#searchInput').oninput = () => { clearTimeout(familySearchTimer); familySearchTimer = setTimeout(() => { selectedId = null; loadFamilies(); }, 300); };

$('#searchInput').onchange = () => { selectedId = null; loadFamilies(); };

$('#refreshBtn').onclick = loadFamilies;

$('#createBtn').onclick = () => { editingFamilyCache = null; openCreateForm(); };

$('#quickOccasionalBtn') && ($('#quickOccasionalBtn').onclick = openQuickOccasionalForm);

$('#quickCallBtn') && ($('#quickCallBtn').onclick = openQuickFollowupForm);

$('#importBtn').onclick = () => $('#importFile').click();

$('#importFile').onchange = async (e) => { const file = e.target.files[0]; if (!file)
    return; try {
    openPreview(JSON.parse(await file.text()), file.name);
}
catch (err) {
    toast(err.message);
    e.target.value = '';
} };

$('#statusFilter').onchange = () => { selectedId = null; loadFamilies(); };

init();
