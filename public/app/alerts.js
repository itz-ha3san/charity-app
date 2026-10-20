/* Feature: alerts. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const alertSeverityNames = { info: 'اطلاع‌رسانی', important: 'مهم', urgent: 'فوری', critical: 'بحرانی' }, alertTypeNames = { weekly_due: 'موعد گزارش هفتگی', weekly_overdue: 'گزارش هفتگی عقب‌افتاده', weekly_pending_review: 'گزارش منتظر تأیید', weekly_revision_requested: 'گزارش برگشتی برای اصلاح', action_due_soon: 'اقدام نزدیک مهلت', action_overdue: 'اقدام عقب‌افتاده', action_result_pending: 'نتیجه منتظر تأیید', referral_no_response: 'ارجاع بدون پاسخ', budget_low: 'بودجه رو به اتمام', financial_stale: 'درخواست مالی معطل', document_expiry: 'انقضای سند', followup_due: 'موعد پیگیری', insurance_renewal: 'تمدید بیمه', rent_renewal: 'تمدید اجاره' };

let alertBadgeRequest=0;
async function refreshAlertBadge() { const request=++alertBadgeRequest;try {
    const user=actor?.id;
    const d = await api('/api/alerts?includeRead=false');if(user!==actor?.id||request!==alertBadgeRequest)return;
    window.AppNotificationInbox?.update(d.unread||0);
    const b = $('#alertBadge'), trigger = $('#alertsBtn');
    if (!b)
        return;
    b.textContent = fa(d.unread);
    b.classList.toggle('hidden', !d.unread);
    b.style.background = d.counts.critical ? 'var(--red-soft)' : d.counts.urgent ? 'var(--orange-soft,var(--blue-soft))' : 'var(--blue-soft)';
    if (trigger) {
        const label = d.unread ? `مرکز پیگیری، ${fa(d.unread)} هشدار خوانده‌نشده` : 'مرکز پیگیری';
        trigger.setAttribute('aria-label', label);
        trigger.title = label;
        trigger.classList.toggle('has-critical', Boolean(d.counts.critical));
    }
}
catch { } }

function alertDate(value) { if (!value)
    return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium',timeZone:'Asia/Tehran' }).format(date); }

async function openAlerts(severity = '', unreadOnly = false) {
    try {
        const params = new URLSearchParams();
        if (severity)
            params.set('severity', severity);
        if (unreadOnly)
            params.set('includeRead', 'false');
        const d = await api('/api/alerts?' + params), counts = d.counts || {}, alerts = d.alerts || [], modalRoot = $('#modalRoot');
        const filters = [['all', 'همه', d.total || 0], ['unread', 'خوانده‌نشده', d.unread || 0], ...['critical', 'urgent', 'important', 'info'].map(key => [key, alertSeverityNames[key], counts[key] || 0])];
        const filterButtons = filters.map(([key, label, count]) => { const active = key === 'all' && !severity && !unreadOnly || key === 'unread' && !severity && unreadOnly || key === severity; const attrs = key === 'all' ? 'data-alert-all' : key === 'unread' ? 'data-alert-unread' : `data-alert-filter="${key}"`; return `<button type="button" class="alert-filter ${active ? 'is-active' : ''}" ${attrs} aria-pressed="${active}"><span>${label}</span><b>${fa(count)}</b></button>`; }).join('');
        const rows = alerts.map(a => `<article class="alert-record severity-${esc(a.severity)} ${a.read ? 'is-read' : ''}"><span class="alert-record-edge" aria-hidden="true"></span><div class="alert-record-content"><div class="alert-record-meta"><span class="alert-severity-pill severity-${esc(a.severity)}"><i></i>${esc(alertSeverityNames[a.severity] || a.severity)}</span><span class="alert-type-label">${esc(alertTypeNames[a.type] || a.type)}</span><span class="alert-read-state ${a.read ? 'is-read' : ''}">${a.read ? 'خوانده‌شده' : 'جدید'}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.message)}</p>${a.dueAt || a.createdAt ? `<div class="alert-record-date">${a.dueAt ? 'موعد' : 'ثبت'}: ${esc(alertDate(a.dueAt || a.createdAt))}</div>` : ''}<div class="alert-record-actions">${a.familyId ? `<button type="button" class="primary" data-open-alert="${encodeURIComponent(a.key)}" data-alert-family="${esc(a.familyId)}">مشاهده پرونده <span aria-hidden="true">←</span></button>` : `<button type="button" class="secondary" data-read-alert="${encodeURIComponent(a.key)}">علامت‌گذاری به‌عنوان خوانده‌شده</button>`}<button type="button" class="alert-dismiss" data-dismiss-alert="${encodeURIComponent(a.key)}">بستن هشدار</button></div></div></article>`).join('');
        const canEditSettings = actor?.role === 'admin' || actor?.position === 'ceo';
        modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal alert-center-modal" role="dialog" aria-modal="true" aria-labelledby="alertCenterTitle"><header class="alert-center-head"><div class="alert-center-title"><span class="alert-center-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><div><small>C.6 · مرکز اعلان‌ها</small><h2 id="alertCenterTitle">هشدارها و پیگیری خودکار</h2><p>موارد مهم را مرور کنید و وضعیت هر هشدار را مدیریت کنید.</p></div></div><div class="alert-center-head-actions">${canEditSettings ? '<button type="button" class="alert-settings-trigger" id="alertSettingsBtn"><span aria-hidden="true">⚙</span> تنظیم آستانه‌ها</button>' : ''}<button class="close-btn" data-close aria-label="بستن هشدارها">×</button></div></header><div class="alert-center-summary"><div><span>خوانده‌نشده</span><b>${fa(d.unread || 0)}</b></div><div><span>فوری و بحرانی</span><b>${fa((counts.urgent || 0) + (counts.critical || 0))}</b></div><div><span>در این فهرست</span><b>${fa(d.total || 0)}</b></div></div><div class="alert-filter-wrap"><div class="alert-filter-heading"><b>فیلتر هشدارها</b><span>برای محدودکردن فهرست، یک گزینه را انتخاب کنید.</span></div><div class="alert-filter-menu" role="toolbar" aria-label="فیلتر هشدارها">${filterButtons}</div></div><div class="alert-list-heading"><h3>فهرست هشدارها</h3><span class="count-chip">${fa(alerts.length)} مورد</span></div><div class="alert-record-list">${rows || `<div class="alert-empty"><span aria-hidden="true">✓</span><b>هشداری برای نمایش نیست</b><p>${severity || unreadOnly ? 'با این فیلتر موردی پیدا نشد.' : 'در حال حاضر هشدار فعالی ثبت نشده است.'}</p></div>`}</div></section></div>`;
        const root = modalRoot.querySelector('.modal-backdrop');
        root.addEventListener('click', e => { if (e.target === root)
            closeModal(); });
        modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
        modalRoot.querySelectorAll('[data-alert-filter]').forEach(b => b.onclick = () => openAlerts(b.dataset.alertFilter, unreadOnly));
        modalRoot.querySelector('[data-alert-all]')?.addEventListener('click', () => openAlerts());
        modalRoot.querySelector('[data-alert-unread]')?.addEventListener('click', () => openAlerts('', true));
        const settings = modalRoot.querySelector('#alertSettingsBtn');
        if (settings)
            settings.onclick = () => openAlertSettings(severity, unreadOnly);
        modalRoot.querySelectorAll('[data-open-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.openAlert + '/read', { method: 'POST', body: '{}' });
            refreshAlertBadge();
            openFamilyRecord(b.dataset.alertFamily);
        }
        catch (e) {
            toast(e.message);
        } });
        modalRoot.querySelectorAll('[data-read-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.readAlert + '/read', { method: 'POST', body: '{}' });
            await openAlerts(severity, unreadOnly);
            refreshAlertBadge();
        }
        catch (e) {
            toast(e.message);
        } });
        modalRoot.querySelectorAll('[data-dismiss-alert]').forEach(b => b.onclick = async () => { try {
            await api('/api/alerts/' + b.dataset.dismissAlert + '/dismiss', { method: 'POST', body: '{}' });
            await openAlerts(severity, unreadOnly);
            refreshAlertBadge();
        }
        catch (e) {
            toast(e.message);
        } });
    }
    catch (e) {
        toast(e.message);
    }
}

async function openAlertSettings(severity = '', unreadOnly = false) {
    try {
        const { settings: x } = await api('/api/alerts/settings'), modalRoot = $('#modalRoot');
        const fields = [['actionDueSoonDays', 'هشدار اقدام نزدیک موعد', 'روز پیش از سررسید', 1, 30], ['referralNoResponseHours', 'ارجاع بدون پاسخ', 'ساعت', 1, 720], ['financeStaleDays', 'درخواست مالی معطل', 'روز', 1, 30], ['budgetWarningPercent', 'هشدار کاهش بودجه', 'درصد مانده', 1, 99], ['budgetCriticalPercent', 'وضعیت بحرانی بودجه', 'درصد مانده', 0, 98], ['documentExpiryDays', 'نزدیکی انقضای سند', 'روز پیش از انقضا', 1, 90]];
        modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal alert-settings-modal" role="dialog" aria-modal="true" aria-labelledby="alertSettingsTitle"><header class="alert-center-head"><div><small>تنظیمات هشدار</small><h2 id="alertSettingsTitle">آستانه‌های یادآوری</h2><p>مشخص کنید سامانه از چه زمانی هشدار ایجاد کند.</p></div><button class="close-btn" data-close aria-label="بازگشت به هشدارها">×</button></header><form id="alertSettingsForm"><div class="alert-settings-grid">${fields.map(([name, label, hint, min, max]) => `<label class="alert-setting-field"><span>${label}<small>${hint}</small></span><input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${esc(x[name])}" required></label>`).join('')}</div><p class="alert-settings-note">آستانهٔ بحرانی بودجه باید از آستانهٔ هشدار کمتر باشد.</p><div id="alertSettingsError" class="message error" aria-live="polite"></div><div class="alert-settings-actions"><button type="button" class="secondary" id="backToAlerts">بازگشت</button><button type="submit" class="primary">ذخیرهٔ تنظیمات</button></div></form></section></div>`;
        modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = () => openAlerts(severity, unreadOnly));
        modalRoot.querySelector('#backToAlerts').onclick = () => openAlerts(severity, unreadOnly);
        modalRoot.querySelector('#alertSettingsForm').onsubmit = async (e) => { e.preventDefault(); const form = e.currentTarget, values = Object.fromEntries(new FormData(form)); for (const key of Object.keys(values))
            values[key] = Number(values[key]); const error = modalRoot.querySelector('#alertSettingsError'); if (values.budgetCriticalPercent >= values.budgetWarningPercent) {
            error.textContent = 'آستانهٔ بحرانی باید از آستانهٔ هشدار کمتر باشد.';
            return;
        } const button = form.querySelector('[type="submit"]'); button.disabled = true; try {
            await api('/api/alerts/settings', { method: 'PUT', body: JSON.stringify(values) });
            toast('تنظیمات هشدار ذخیره شد.');
            await openAlerts(severity, unreadOnly);
        }
        catch (err) {
            error.textContent = err.message;
            button.disabled = false;
        } };
    }
    catch (e) {
        toast(e.message);
    }
}

async function openFinancialInbox() { try {
    const d = await api('/api/financial-cases/inbox');
    AppUI.mountModal(`<div class="modal-backdrop"><div class="modal audit-modal"><div class="modal-head"><div><div class="eyebrow">C.5</div><h2>کارتابل ${d.mode === 'finance' ? 'پرداخت' : 'تأیید مالی'}</h2></div><button class="close-btn" data-close>×</button></div>${d.items.map(x => `<button class="family-item" data-fin-family="${x.familyId}"><div class="family-item-head"><b>${esc(x.title)}</b><span class="finance-status ${financeStatusClass(x.status)}">${esc(x.status)}</span></div><p>${esc(x.caseNumber)} · ${esc(x.headName)} · ${money(x.approvedAmount || x.amount)} تومان · ${esc(sourceTypeNames[x.sourceType] || x.sourceType)}</p></button>`).join('') || '<div class="empty-state">موردی در کارتابل نیست.</div>'}</div></div>`);
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    document.querySelectorAll('[data-fin-family]').forEach(b => b.onclick = () => { closeModal(); loadDetail(b.dataset.finFamily); });
}
catch (e) {
    toast(e.message);
} }

/* Compact inbox shares the server's existing per-user alert state. No extra polling. */
(() => {
 let tab='all',request=0,busy=false;
 const E=()=>window.EnhancedUI;
 const bell='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
 const owner=()=>typeof actor!=='undefined'?actor?.id:null;
 function close(){request++;document.querySelector('#notificationInboxPanel')?.remove();const b=document.querySelector('#notificationInboxBtn');b?.setAttribute('aria-expanded','false');}
 function position(){const panel=document.querySelector('#notificationInboxPanel'),button=document.querySelector('#notificationInboxBtn');if(!panel||!button)return;const b=button.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(innerWidth-panel.offsetWidth-12,b.right-panel.offsetWidth))+'px';panel.style.top=Math.max(12,Math.min(innerHeight-panel.offsetHeight-12,b.bottom+8))+'px';}
 function update(count){
  if(!owner())return;let button=document.querySelector('#notificationInboxBtn');if(!button){const host=document.querySelector('.topbar-actions');if(!host)return;button=document.createElement('button');button.id='notificationInboxBtn';button.type='button';button.className='app-notifications-trigger';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','notificationInboxPanel');host.prepend(button);button.onclick=()=>document.querySelector('#notificationInboxPanel')?(close(),button.focus()):open();}
  button.innerHTML=bell+(count>0?`<span class="app-notifications-count">${E().esc(PersianRules.fa(count))}</span>`:'');button.setAttribute('aria-label',`اعلان‌ها، ${PersianRules.fa(count)} خوانده‌نشده`);
 }
 function dayBucket(value){if(!value)return 'بدون تاریخ ثبت';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'بدون تاریخ ثبت';const day=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day))/864e5;};const difference=day(new Date())-day(date);return difference===0?'امروز':difference===1?'دیروز':difference<0?'آینده':'قدیمی‌تر';}
 async function open(){
  const user=owner();if(!user)return;close();const id=++request;
  const panel=document.createElement('section');panel.id='notificationInboxPanel';panel.className='app-notifications-panel';panel.dir='rtl';panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','صندوق اعلان‌ها');panel.innerHTML=E().spinner('در حال دریافت اعلان‌ها…');document.body.append(panel);document.querySelector('#notificationInboxBtn')?.setAttribute('aria-expanded','true');position();panel.focus();
  try{const d=await api('/api/alerts?includeRead=true');if(id!==request||user!==owner()||!panel.isConnected)return;
   const items=d.alerts||[];update(d.unread||0);
   const draw=()=>{
    const visible=items.filter(n=>tab==='all'||!n.read).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const groups=['امروز','دیروز','آینده','قدیمی‌تر','بدون تاریخ ثبت'].map(g=>({g,list:visible.filter(n=>dayBucket(n.createdAt)===g)})).filter(g=>g.list.length);
    panel.innerHTML=`<div class="app-notifications-head"><button type="button" class="secondary" data-notification-tab="all" aria-pressed="${tab==='all'}">همه</button><button type="button" class="secondary" data-notification-tab="unread" aria-pressed="${tab==='unread'}">نخوانده (${E().esc(PersianRules.fa(d.unread||0))})</button><button type="button" class="secondary" data-read-all ${!d.unread?'disabled':''}>خواندن همه</button><button type="button" class="secondary" data-notification-close aria-label="بستن اعلان‌ها">×</button></div><p class="app-notifications-status" role="status"></p>${groups.length?groups.map(({g,list})=>`<h3>${g}</h3>${list.map(n=>`<article class="app-notification ${!n.read?'is-unread':''}"><div class="app-notification-content"><button type="button" data-notification-open="${E().esc(n.key)}">${E().esc(n.title)}</button><small>${E().esc(alertSeverityNames[n.severity]||'اطلاع‌رسانی')}${n.createdAt?' · '+E().esc(alertDate(n.createdAt)):n.dueAt?' · موعد '+E().esc(alertDate(n.dueAt)):''}</small></div>${!n.read?`<div class="app-notification-actions"><button type="button" class="secondary" data-notification-read="${E().esc(n.key)}">خواندم</button></div>`:''}</article>`).join('')}`).join(''):'<p class="muted">اعلانی برای نمایش نیست.</p>'}<button type="button" class="secondary app-notifications-footer" data-notification-all>مشاهدهٔ همه در مرکز پیگیری</button>`;
    panel.querySelectorAll('[data-notification-tab]').forEach(b=>b.onclick=()=>{if(busy)return;tab=b.dataset.notificationTab;draw();panel.querySelector(`[data-notification-tab="${tab}"]`)?.focus();});
    panel.querySelector('[data-notification-close]').onclick=()=>{close();document.querySelector('#notificationInboxBtn')?.focus();};
    panel.querySelector('[data-notification-all]').onclick=()=>{close();openAlerts();};
    const run=async(action)=>{if(busy)return;busy=true;const status=panel.querySelector('.app-notifications-status');status.setAttribute('role','status');panel.setAttribute('aria-busy','true');panel.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='در حال ثبت وضعیت…';try{await action();await refreshAlertBadge();if(user===owner()&&panel.isConnected)await open();}catch(error){if(panel.isConnected){status.textContent='ثبت وضعیت انجام نشد؛ دوباره تلاش کنید.';status.setAttribute('role','alert');await refreshAlertBadge();busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);panel.setAttribute('aria-busy','false');}}finally{busy=false;}};
    panel.querySelector('[data-read-all]').onclick=()=>run(async()=>{for(const n of items.filter(n=>!n.read)){if(user!==owner())throw Error('SESSION_CHANGED');await api('/api/alerts/'+encodeURIComponent(n.key)+'/read',{method:'POST',body:'{}'});}});
    panel.querySelectorAll('[data-notification-read]').forEach(b=>b.onclick=()=>run(()=>api('/api/alerts/'+encodeURIComponent(b.dataset.notificationRead)+'/read',{method:'POST',body:'{}'})));
    panel.querySelectorAll('[data-notification-open]').forEach(b=>b.onclick=()=>{const n=items.find(n=>n.key===b.dataset.notificationOpen);run(async()=>{await api('/api/alerts/'+encodeURIComponent(n.key)+'/read',{method:'POST',body:'{}'});close();if(n.familyId)openFamilyRecord(n.familyId);else openAlerts();});});
    position();
   };draw();
  }catch(error){if(id===request&&panel.isConnected){panel.innerHTML=E().alertMarkup({variant:'destructive',text:'دریافت اعلان‌ها ممکن نشد. دوباره تلاش کنید.'})+'<button type="button" class="secondary" data-retry>تلاش مجدد</button><button type="button" class="secondary" data-close-inbox>بستن</button>';panel.querySelector('[data-retry]').onclick=open;panel.querySelector('[data-close-inbox]').onclick=()=>{close();document.querySelector('#notificationInboxBtn')?.focus();};position();}}
 }
 document.addEventListener('click',e=>{const b=document.querySelector('#notificationInboxBtn'),p=document.querySelector('#notificationInboxPanel');if(e.target.closest('#logoutBtn')){close();b?.remove();}else if(p&&!e.composedPath().includes(p)&&!e.composedPath().includes(b))close();});
 document.addEventListener('keydown',e=>{const p=document.querySelector('#notificationInboxPanel');if(!p)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();document.querySelector('#notificationInboxBtn')?.focus();}else if(e.key==='Tab'){const buttons=[...p.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;const index=buttons.indexOf(document.activeElement);if(e.shiftKey&&(index<=0)){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&(index<0||index===buttons.length-1)){e.preventDefault();buttons[0].focus();}}},true);
 window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
 window.AppNotificationInbox=Object.freeze({update,open,close,dayBucket});
})();
