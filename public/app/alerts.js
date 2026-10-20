/* Feature: alerts. Transitional classic-script boundary; see FRONTEND-STRUCTURE.md. */
const alertSeverityNames = { info: 'اطلاع‌رسانی', important: 'مهم', urgent: 'فوری', critical: 'بحرانی' }, alertTypeNames = { weekly_due: 'موعد گزارش هفتگی', weekly_overdue: 'گزارش هفتگی عقب‌افتاده', weekly_pending_review: 'گزارش منتظر تأیید', weekly_revision_requested: 'گزارش برگشتی برای اصلاح', action_due_soon: 'اقدام نزدیک مهلت', action_overdue: 'اقدام عقب‌افتاده', action_result_pending: 'نتیجه منتظر تأیید', referral_no_response: 'ارجاع بدون پاسخ', budget_low: 'بودجه رو به اتمام', financial_stale: 'درخواست مالی معطل', document_expiry: 'انقضای سند', followup_due: 'موعد پیگیری', insurance_renewal: 'تمدید بیمه', rent_renewal: 'تمدید اجاره' };

let alertBadgeRequest=0;
async function refreshAlertBadge() {
    const request=++alertBadgeRequest,user=actor?.id;if(!user)return;
    const [alerts,messages]=await Promise.allSettled([api('/api/alerts?includeRead=false'),api('/api/messages/inbox?includeRead=false')]);
    if(user!==actor?.id||request!==alertBadgeRequest)return;
    const d=alerts.status==='fulfilled'?alerts.value:null,m=messages.status==='fulfilled'?messages.value:null;
    window.AppNotificationInbox?.update((Number(d?.unread)||0)+(Number(m?.unread)||0),!d||!m);
    const b=$('#alertBadge'),trigger=$('#alertsBtn');if(!b)return;
    b.textContent=d?fa(d.unread):'—';b.classList.toggle('hidden',Boolean(d&&!d.unread));
    b.style.background=d?.counts?.critical?'var(--red-soft)':d?.counts?.urgent?'var(--orange-soft,var(--blue-soft))':'var(--blue-soft)';
    if(trigger){const label=!d?'مرکز پیگیری؛ دریافت هشدارها ناموفق بود':d.unread?`مرکز پیگیری، ${fa(d.unread)} هشدار خوانده‌نشده`:'مرکز پیگیری';trigger.setAttribute('aria-label',label);trigger.title=label;trigger.classList.toggle('has-critical',Boolean(d?.counts?.critical));}
}

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

/* One compact inbox for authorized management messages and system alerts. */
(() => {
  let tab='all', request=0, busy=false, session=null;
  const owner=()=>typeof actor!=='undefined'?actor?.id:null;
  const E=()=>window.EnhancedUI;
  const fa=v=>PersianRules.fa(v);
  const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${({bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',retry:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>'})[name]||''}</svg>`;
  const current=()=>document.querySelector('#notificationInboxPanel');
  function close(){request++;current()?.remove();document.querySelector('#notificationInboxBtn')?.setAttribute('aria-expanded','false');}
  function position(){const panel=current(),button=document.querySelector('#notificationInboxBtn');if(!panel||!button)return;const b=button.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(innerWidth-panel.offsetWidth-12,b.right-panel.offsetWidth))+'px';panel.style.top=Math.max(12,Math.min(innerHeight-panel.offsetHeight-12,b.bottom+8))+'px';}
  function update(count,partial=false){
    const user=owner();if(!user)return;
    if(session!==user){close();tab='all';session=user;}
    let button=document.querySelector('#notificationInboxBtn');
    if(!button){const host=document.querySelector('.topbar-actions');if(!host)return;button=document.createElement('button');button.id='notificationInboxBtn';button.type='button';button.className='app-notifications-trigger';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','notificationInboxPanel');host.prepend(button);button.onclick=()=>current()?(close(),button.focus()):open();}
    button.innerHTML=icon('bell')+(count>0?`<span class="app-notifications-count">${E().esc(fa(count>99?'۹۹+':count))}</span>`:'')+(partial?'<i class="app-notifications-degraded" aria-hidden="true"></i>':'');
    button.setAttribute('aria-label',`اعلان‌ها، ${fa(count)} خوانده‌نشده${partial?'؛ دریافت بخشی از صندوق ناموفق بود':''}`);button.title='پیام‌ها و اعلان‌ها';
  }
  function dayBucket(value){if(!value)return 'بدون تاریخ ثبت';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'بدون تاریخ ثبت';const day=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day))/864e5;};const difference=day(new Date())-day(date);return difference===0?'امروز':difference===1?'دیروز':difference<0?'آینده':'قدیمی‌تر';}
  const errorText=(kind,error)=>{
    const name=kind==='messages'?'پیام‌ها':'هشدارها';
    if(error?.status===401)return 'نشست شما پایان یافته؛ دوباره وارد شوید.';
    if(error?.data?.error==='MIGRATIONS_REQUIRED')return 'برای دریافت '+name+'، به‌روزرسانی دیتابیس لازم است.';
    return name+' دریافت نشد؛ دوباره تلاش کنید.';
  };
  async function open(){
    const user=owner();if(!user)return;if(session!==user){tab='all';session=user;}close();const id=++request;
    const panel=document.createElement('section');panel.id='notificationInboxPanel';panel.className='app-notifications-panel';panel.dir='rtl';panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','پیام‌ها و اعلان‌ها');
    panel.innerHTML=`<header class="app-notifications-title"><div>${icon('bell')}<h2>پیام‌ها و اعلان‌ها</h2></div><button type="button" data-notification-close aria-label="بستن اعلان‌ها">${icon('close')}</button></header><div class="app-notifications-loading">${E().spinner('در حال دریافت…','sm')}</div>`;
    panel.querySelector('[data-notification-close]').onclick=()=>{close();document.querySelector('#notificationInboxBtn')?.focus();};document.body.append(panel);document.querySelector('#notificationInboxBtn')?.setAttribute('aria-expanded','true');position();panel.focus();
    const results=await Promise.allSettled([api('/api/alerts?includeRead=true'),api('/api/messages/inbox?includeRead=true')]);
    if(id!==request||user!==owner()||!panel.isConnected)return;
    const [alerts,messages]=results,failures=results.flatMap((r,i)=>r.status==='rejected'?[{kind:i?'messages':'alerts',error:r.reason}]:[]);
    const alertsData=alerts.status==='fulfilled'?alerts.value:{alerts:[],unread:0};const messagesData=messages.status==='fulfilled'?messages.value:{messages:[],unread:0};
    const unread=(Number(alertsData.unread)||0)+(Number(messagesData.unread)||0);update(unread,failures.length>0);
    if(!panel.isConnected)return;
    const items=[...(messagesData.messages||[]).map(n=>({...n,key:'message:'+n.id,kind:'message',read:Boolean(n.readAt)})),...(alertsData.alerts||[]).map(n=>({...n,kind:'alert'}))];
    let expanded=null;
    const tone=n=>['critical','urgent','important','info'].includes(n.severity)?n.severity:'info';
    const row=n=>{
      const needsAck=n.kind==='message'&&n.acknowledgementRequired&&!n.acknowledgedAt;
      const date=n.createdAt||n.dueAt;
      return `<article class="app-notification ${!n.read?'is-unread':''}" data-inbox-kind="${n.kind}" data-severity="${tone(n)}">
        <span class="app-notification-icon">${icon(n.kind==='message'?'mail':'bell')}</span><div class="app-notification-content">
        <button type="button" class="app-notification-open" data-notification-open="${E().esc(n.key)}" ${n.kind==='message'?`aria-expanded="${expanded===n.key}"`:''}><span>${E().esc(n.title)}</span>${!n.read?'<i class="app-notification-dot" aria-label="خوانده‌نشده"></i>':''}</button>
        <div class="app-notification-meta"><span>${n.kind==='message'?E().esc(n.senderName||'مدیریت'):E().esc(alertSeverityNames[n.severity]||'هشدار سامانه')}</span>${date?`<time>${n.createdAt?'':'موعد: '}${E().esc(alertDate(date))}</time>`:''}</div>
        ${needsAck?'<span class="app-notification-ack-label">نیازمند تأیید شما</span>':''}
        ${expanded===n.key?`<div class="app-notification-detail"><p>${E().esc(n.body||'')}</p><div class="app-notification-detail-actions">${needsAck?`<button type="button" data-message-ack="${E().esc(n.key)}">${icon('check')}خواندم و متوجه شدم</button>`:n.acknowledgedAt?'<span>تأیید کرده‌اید</span>':''}${n.familyId?`<button type="button" data-inbox-family="${E().esc(n.key)}">مشاهده پرونده ←</button>`:''}</div></div>`:''}
        ${!n.read?`<button type="button" class="app-notification-read" data-notification-read="${E().esc(n.key)}">علامت‌گذاری خوانده‌شده</button>`:''}</div></article>`;
    };
    const draw=()=>{
      const visible=items.filter(n=>tab==='all'||tab==='unread'&&!n.read||tab==='messages'&&n.kind==='message'||tab==='alerts'&&n.kind==='alert').slice().sort((a,b)=>String(b.createdAt||b.dueAt||'').localeCompare(String(a.createdAt||a.dueAt||'')));
      const groups=['امروز','دیروز','آینده','قدیمی‌تر','بدون تاریخ ثبت'].map(g=>({g,list:visible.filter(n=>dayBucket(n.createdAt||n.dueAt)===g)})).filter(g=>g.list.length);
      panel.innerHTML=`<header class="app-notifications-title"><div>${icon('bell')}<h2>پیام‌ها و اعلان‌ها</h2>${unread?`<span>${E().esc(fa(unread))} جدید</span>`:''}</div><button type="button" data-notification-close aria-label="بستن اعلان‌ها">${icon('close')}</button></header>
      <div class="app-notifications-tabs" role="group" aria-label="فیلتر صندوق">${[['all','همه'],['unread','نخوانده'],['messages','پیام‌ها'],['alerts','هشدارها']].map(([key,label])=>`<button type="button" data-notification-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('')}</div>
      ${failures.length?`<div class="app-notifications-error" role="status"><span>${failures.map(f=>E().esc(errorText(f.kind,f.error))).join('<br>')}</span><button type="button" data-retry aria-label="تلاش مجدد برای دریافت صندوق">${icon('retry')}</button></div>`:''}
      <p class="app-notifications-status" role="status"></p><div class="app-notifications-list">${groups.length?groups.map(({g,list})=>`<h3>${g}</h3>${list.map(row).join('')}`).join(''):`<div class="app-notifications-empty">${icon(failures.length?'retry':'check')}<b>${failures.length?'دریافت صندوق کامل نشد':tab==='unread'?'همه را خوانده‌اید':'موردی برای نمایش نیست'}</b><p>${failures.length?'می‌توانید دوباره تلاش کنید.':'پیام‌ها و هشدارهای جدید اینجا نمایش داده می‌شوند.'}</p></div>`}</div>
      <footer class="app-notifications-toolbar"><button type="button" data-read-all ${!items.some(n=>!n.read)?'disabled':''}>${icon('check')}${unread>items.filter(n=>!n.read).length?'خواندن موارد این صفحه':'خواندن همه'}</button><button type="button" data-notification-all>مرکز پیگیری ←</button></footer>`;
      panel.querySelector('[data-notification-close]').onclick=()=>{close();document.querySelector('#notificationInboxBtn')?.focus();};panel.querySelector('[data-retry]')?.addEventListener('click',()=>{if(!busy)open();});
      panel.querySelector('[data-notification-all]').onclick=()=>{close();openAlerts();};
      panel.querySelectorAll('[data-notification-tab]').forEach(b=>b.onclick=()=>{if(busy)return;tab=b.dataset.notificationTab;draw();panel.querySelector(`[data-notification-tab="${tab}"]`)?.focus();});
      const run=async action=>{
        if(busy)return;busy=true;const status=panel.querySelector('.app-notifications-status');status.setAttribute('role','status');status.textContent='در حال ثبت…';panel.setAttribute('aria-busy','true');panel.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await action();if(user===owner()&&panel.isConnected){busy=false;await refreshAlertBadge();if(user===owner()&&panel.isConnected)await open();}}
        catch(error){if(user===owner()&&panel.isConnected){status.textContent='ثبت وضعیت انجام نشد؛ دوباره تلاش کنید.';status.setAttribute('role','alert');await refreshAlertBadge();if(panel.isConnected){busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);panel.setAttribute('aria-busy','false');}}}
        finally{busy=false;}
      };
      const read=async n=>{if(user!==owner())throw Error('SESSION_CHANGED');await api(n.kind==='message'?'/api/messages/'+encodeURIComponent(n.id)+'/read':'/api/alerts/'+encodeURIComponent(n.key)+'/read',{method:'POST',body:'{}'});};
      panel.querySelector('[data-read-all]').onclick=()=>run(async()=>{for(const n of items.filter(n=>!n.read))await read(n);});
      panel.querySelectorAll('[data-notification-read]').forEach(b=>b.onclick=()=>run(()=>read(items.find(n=>n.key===b.dataset.notificationRead))));
      panel.querySelectorAll('[data-message-ack]').forEach(b=>b.onclick=()=>run(async()=>{const n=items.find(n=>n.key===b.dataset.messageAck);if(user!==owner())throw Error('SESSION_CHANGED');await api('/api/messages/'+encodeURIComponent(n.id)+'/acknowledge',{method:'POST',body:'{}'});}));
      panel.querySelectorAll('[data-inbox-family]').forEach(b=>b.onclick=()=>{const n=items.find(n=>n.key===b.dataset.inboxFamily);close();openFamilyRecord(n.familyId);});
      panel.querySelectorAll('[data-notification-open]').forEach(b=>b.onclick=()=>{
        if(busy)return;const n=items.find(n=>n.key===b.dataset.notificationOpen);
        if(n.kind==='message'){expanded=expanded===n.key?null:n.key;draw();panel.querySelector(`[data-notification-open="${CSS.escape(n.key)}"]`)?.focus();position();}
        else run(async()=>{if(!n.read)await read(n);close();if(n.familyId)openFamilyRecord(n.familyId);else openAlerts();await refreshAlertBadge();});
      });position();
    };draw();
  }
  document.addEventListener('click',e=>{const b=document.querySelector('#notificationInboxBtn'),p=current();if(e.target.closest('#logoutBtn')){close();b?.remove();session=null;tab='all';}else if(p&&!e.composedPath().some(n=>n?.id==='notificationInboxPanel')&&!e.composedPath().includes(b))close();});
  document.addEventListener('keydown',e=>{const p=current();if(!p)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();document.querySelector('#notificationInboxBtn')?.focus();}else if(e.key==='Tab'){const buttons=[...p.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;const index=buttons.indexOf(document.activeElement);if(e.shiftKey&&index<=0){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&(index<0||index===buttons.length-1)){e.preventDefault();buttons[0].focus();}}},true);
  window.addEventListener('sessionexpired',()=>{close();document.querySelector('#notificationInboxBtn')?.remove();session=null;});
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  window.AppNotificationInbox=Object.freeze({update,open,close,dayBucket});
})();
