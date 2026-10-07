(()=>{const fa=v=>window.ControlSystem?.fa(v)??String(v),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron='<svg class="ui-crumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',check='<svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>';
function breadcrumb(root,items){root.classList.add('ui-breadcrumb');root.setAttribute('aria-label','مسیر');root.innerHTML=`<ol>${items.map((x,i)=>`<li>${x.href&&i<items.length-1?`<a href="${esc(x.href)}">${esc(x.label)}</a>`:`<span ${i===items.length-1?'aria-current="page"':''}>${esc(x.label)}</span>`}${i<items.length-1?chevron:''}</li>`).join('')}</ol>`;return root}
function stepper(root,steps,current,{orientation='horizontal'}={}){root.classList.add('ui-stepper');root.dataset.orientation=orientation;root.setAttribute('aria-label','مراحل');root.innerHTML=steps.map((s,i)=>{const state=i<current?'done':i===current?'active':'pending';return`<li class="ui-step" data-state="${state}" ${state==='active'?'aria-current="step"':''}><div class="ui-step-line"><span class="ui-step-circle">${state==='done'?check:fa(i+1)}</span>${i<steps.length-1?'<span class="ui-step-connector"></span>':''}</div><div class="ui-step-copy"><b>${esc(s.label)}</b>${s.description?`<small>${esc(s.description)}</small>`:''}</div></li>`}).join('');return root}
function progress(root,{value,max=100,label='',showValue=true,size='md'}={}){const pct=Math.min(100,Math.max(0,value/max*100));root.classList.add('ui-progress');root.dataset.size=size;root.innerHTML=`${label||showValue?`<div class="ui-progress-head"><span>${esc(label)}</span>${showValue?`<span class="ui-progress-value">${fa(Math.round(pct))}٪</span>`:''}</div>`:''}<div class="ui-progress-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}"><div class="ui-progress-fill" style="width:${pct}%"></div></div>`;return root}
function badge(root,variant='default'){root.classList.add('ui-badge');root.dataset.variant=variant;return root}
function stat(root,{label,value,unit='',delta,deltaLabel='نسبت به دوره قبل'}={}){root.classList.add('ui-stat');const up=(delta??0)>=0;root.innerHTML=`<div class="ui-stat-label">${esc(label)}</div><div class="ui-stat-main"><div class="ui-stat-value">${esc(value)}${unit?`<span class="ui-stat-unit">${esc(unit)}</span>`:''}</div>${delta!==undefined?`<span class="ui-stat-delta" data-up="${up}" title="${esc(deltaLabel)}">${up?'↖':'↙'} ${fa(Math.abs(delta))}٪</span>`:''}</div>`;return root}
let tid=0,toasts=[];function toast({title,description='',variant='default',action,duration=4000}={}){const id=++tid,viewport=document.querySelector('.ui-toast-viewport')||document.body.appendChild(Object.assign(document.createElement('div'),{className:'ui-toast-viewport'}));const card=document.createElement('div');card.className='ui-toast-card';card.dataset.variant=variant;card.setAttribute('role',variant==='error'?'alert':'status');card.innerHTML=`<span class="ui-toast-icon">${variant==='success'?'✓':variant==='error'?'!':'i'}</span><div class="ui-toast-copy"><div class="ui-toast-title">${esc(title)}</div>${description?`<div class="ui-toast-description">${esc(description)}</div>`:''}</div>${action?`<button class="ui-toast-action">${esc(action.label)}</button>`:''}<button class="ui-toast-close" aria-label="بستن">×</button>`;viewport.append(card);const dismiss=()=>{card.remove();toasts=toasts.filter(x=>x.id!==id);syncAll()};card.querySelector('.ui-toast-close').onclick=dismiss;if(action)card.querySelector('.ui-toast-action').onclick=()=>{action.onClick?.();dismiss()};const timer=setTimeout(dismiss,duration);toasts.push({id,card,timer,dismiss});while(toasts.length>3){clearTimeout(toasts[0].timer);toasts.shift().card.remove()}syncAll();function syncAll(){let b=viewport.querySelector('.ui-toast-dismiss-all');if(toasts.length>1&&!b){b=document.createElement('button');b.className='ui-toast-dismiss-all';b.textContent=`بستن همه (${fa(toasts.length)})`;b.onclick=()=>[...toasts].forEach(x=>x.dismiss());viewport.append(b)}else if(b&&toasts.length<=1)b.remove();else if(b)b.textContent=`بستن همه (${fa(toasts.length)})`}return id}
function alert(root,variant='info'){root.classList.add('ui-alert');root.dataset.variant=variant;if(variant==='destructive')root.setAttribute('role','alert');else root.setAttribute('role','status');return root}
function table(el){if(el.dataset.uiTable)return;el.dataset.uiTable='1';el.classList.add('ui-table');if(!el.parentElement.classList.contains('ui-table-wrap')){const w=document.createElement('div');w.className='ui-table-wrap';el.parentNode.insertBefore(w,el);w.append(el)}return el}
function sidebar(nav){if(!nav||nav.dataset.uiSidebar)return;nav.dataset.uiSidebar='1';nav.classList.add('ui-sidebar-source');const dash0=document.querySelector('#dashboard'),prev=dash0&&dash0.querySelector(':scope > .dashboard-layout');if(prev){const pm=prev.querySelector(':scope > .dashboard-main'),keep=pm?[...pm.children].filter(x=>!x.classList.contains('workspace-overview')&&!x.classList.contains('ui-sidebar-source')):[];prev.replaceWith(...keep)}const layout=document.createElement('div');layout.className='dashboard-layout';const aside=document.createElement('aside');aside.className='ui-sidebar';aside.innerHTML='<div class="ui-sidebar-head"><b>مرکز عملیات</b><span>دسترسی سریع به بخش‌های سامانه</span></div><nav class="ui-sidebar-nav"></nav><div class="ui-sidebar-footer">برای جست‌وجوی سریع Ctrl K را فشار دهید</div>';const group=document.createElement('div');group.className='ui-sidebar-group';group.dataset.open='true';group.innerHTML='<button type="button" class="ui-sidebar-group-title">بخش‌ها <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button><div class="ui-sidebar-items"></div>';aside.querySelector('.ui-sidebar-nav').append(group);const items=group.querySelector('.ui-sidebar-items');[...nav.children].forEach(b=>{b.classList.remove('secondary','primary');b.classList.add('ui-sidebar-item');items.append(b)});group.querySelector('.ui-sidebar-group-title').onclick=()=>group.dataset.open=String(group.dataset.open!=='true');const dash=document.querySelector('#dashboard'),main=document.createElement('div');main.className='dashboard-main';const head=dash.querySelector('.dashboard-head');head.after(layout);layout.append(aside,main);main.append(nav);[...dash.children].filter(x=>x!==head&&x!==layout&&x.id!=='sessionAlert').forEach(x=>main.append(x));window.dispatchEvent(new CustomEvent('uisidebarready',{detail:{aside}}));return aside}
/* ---------------- Family completeness ---------------- */
const familyFieldLabels={
  caseNumber:'شماره پرونده',
  familySurname:'نام خانوادگی',
  headName:'نام سرپرست',
  headNationalId:'کد ملی سرپرست',
  headPhone:'شماره تماس سرپرست',
  headBirthDate:'تاریخ تولد سرپرست',
  headJob:'شغل سرپرست',
  headEducation:'تحصیلات سرپرست',
  address:'نشانی',
  housingType:'نوع مسکن',
  housingCost:'اجاره یا ودیعه',
  members:'اعضای خانوار',
  notes:'توضیحات پرونده',
  priority:'اولویت',
  insurance:'بیمه',
  medical:'وضعیت درمانی',
  notesHistory:'سابقه پیگیری',
  profileData:'اطلاعات کامل پرونده'
};

function familyCompleteness(f){
  if(!f) return {percent:0,missing:[],present:0,total:0};
  const isAdmin=window.currentActor?.role==='admin'||window.currentActor?.position==='ceo';
  const checks=[
    ['caseNumber',Boolean(f.caseNumber)],
    ['familySurname',Boolean(f.familySurname)],
    ['headName',Boolean(f.headName)],
    ['headNationalId',Boolean(f.headNationalId)],
    ['headPhone',Boolean(f.headPhone)],
    ['headBirthDate',Boolean(f.headBirthDate)],
    ['headJob',Boolean(f.headJob)],
    ['headEducation',Boolean(f.headEducation?.description||f.headEducation?.level)],
    ['address',Boolean(f.address&&String(f.address).trim())],
    ['housingType',Boolean(f.housingType)],
    ['housingCost',Number(f.housingRent)>0||Number(f.housingDeposit)>0],
    ['members',Boolean(f.members?.length)],
    ['notes',Boolean(f.notes&&String(f.notes).trim())],
    ['priority',Boolean(f.priority)],
['insurance',Boolean(f.insurance&&(f.insurance.type||f.insurance.cost))],
['medical',Boolean(f.medical && (typeof f.medical.hasCondition === 'boolean' || String(f.medical.description||'').trim()))],
    ['notesHistory',Boolean(f.notesHistory?.length)],
    ...(isAdmin?[['profileData',Boolean(f.profileData&&Object.keys(f.profileData).length)]]:[])
  ];
  const present=checks.filter(([,ok])=>ok).length;
  const total=checks.length;
  const percent=total?Math.round(present*100/total):0;
  const missing=checks.filter(([,ok])=>!ok).map(([key])=>familyFieldLabels[key]||key);
  return {percent,missing,present,total};
}

function completeness(f){return familyCompleteness(f).percent}

function familyProgress(f){
  const detail=document.querySelector('#familyDetail');
  if(!detail) return;
  detail.querySelector('.ui-family-progress')?.remove();
  const info=familyCompleteness(f);
  const pct=info.percent;
  const members=!!f.members?.length;
  const history=!!f.notesHistory?.length;
  const full=!!(f.profileData&&Object.keys(f.profileData).length);
  const core=!!(f.caseNumber&&f.headName&&f.headNationalId&&f.headPhone);
  const current=!core?0:!members?1:!history?2:!full?3:4;
  const summary=pct<50?'اطلاعات پایه نیاز به تکمیل دارد.':pct<80?'پرونده در حال تکمیل است.':'پرونده اطلاعات مناسبی برای پیگیری دارد.';
  const preview=info.missing.slice(0,8);
  const extra=info.missing.length-preview.length;
  const missingHtml=info.missing.length
    ? `<div class="ui-family-missing" role="status">
         <b>موارد ناقص (${fa(info.missing.length)} مورد):</b>
         <div class="ui-family-missing-list">
           ${preview.map(x=>`<span class="ui-family-missing-chip">${esc(x)}</span>`).join('')}
           ${extra>0?`<span class="ui-family-missing-chip ui-family-missing-chip-more">و ${fa(extra)} مورد دیگر</span>`:''}
         </div>
       </div>`
    : '';
  const box=document.createElement('section');
  box.className='ui-family-progress';
  box.innerHTML=`<div class="ui-family-progress-top"><div><h3>تکمیل اطلاعات خانواده</h3><p>${summary}</p></div><div class="ui-complete-score" style="--score:${pct*3.6}deg"><span>${fa(pct)}٪</span></div></div>${missingHtml}<div data-family-bar></div><ol data-family-steps></ol>`;
  const head=detail.querySelector('.detail-head');
  head?.after(box);
  progress(box.querySelector('[data-family-bar]'),{value:pct,label:'میزان کامل‌بودن داده‌ها',showValue:true,size:'sm'});
  stepper(box.querySelector('[data-family-steps]'),[{label:'اطلاعات پایه',description:'هویت و تماس'},{label:'اعضای خانواده',description:'ترکیب خانوار'},{label:'سوابق پیگیری',description:'یادداشت‌ها و اقدامات'},{label:'پرونده جامع',description:'اطلاعات تکمیلی'},{label:'آماده پیگیری',description:'پرونده عملیاتی'}],current);
  document.querySelector('#familyBreadcrumb')?.remove();
}

function scan(root=document){root.querySelectorAll?.('table:not([data-ui-table])').forEach(table);root.querySelectorAll?.('.session-alert,.archive-banner').forEach(x=>alert(x,'destructive'));root.querySelectorAll?.('.message.success').forEach(x=>alert(x,'success'));root.querySelectorAll?.('.message.error').forEach(x=>{if(x.textContent.trim())alert(x,'destructive')});root.querySelectorAll?.('.metric-card').forEach(x=>x.classList.add('ui-stat'));root.querySelectorAll?.('.count-chip').forEach(x=>badge(x,'secondary'));root.querySelectorAll?.('.status,.priority').forEach(x=>badge(x,'outline'));root.querySelectorAll?.('.archive-status,.finance-status.rejected').forEach(x=>badge(x,'destructive'));root.querySelectorAll?.('.finance-status.paid,.finance-status.approved').forEach(x=>badge(x,'success'))}
function init(){scan();const nav=document.querySelector('#opsNav');if(nav)sidebar(nav);new MutationObserver(rs=>{rs.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1){scan(n);if(n.id==='opsNav')sidebar(n)}}))}).observe(document.body,{childList:true,subtree:true});window.addEventListener('familyloaded',e=>familyProgress(e.detail.family))}
window.UXSystem={breadcrumb,stepper,sidebar,toast,alert,progress,badge,table,stat,familyProgress,familyCompleteness};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();