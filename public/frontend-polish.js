(()=> {
  const root=document.documentElement;
  const $=s=>document.querySelector(s);

  // Persisted light/dark theme without disturbing the existing system preference fallback.
  const stored=localStorage.getItem('c14-theme');
  if(stored==='light'||stored==='dark') root.dataset.theme=stored;

  const themeBtn=$('#themeToggle');
  const syncTheme=()=>{
    const dark=root.dataset.theme==='dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    if(themeBtn){
      themeBtn.textContent=dark?'☀':'☾';
      themeBtn.setAttribute('aria-label',dark?'فعال‌کردن پوسته روشن':'فعال‌کردن پوسته تاریک');
      themeBtn.title=dark?'پوسته روشن':'پوسته تاریک';
    }
  };
  themeBtn?.addEventListener('click',()=>{
    const next=(root.dataset.theme==='dark'?'light':'dark');
    root.dataset.theme=next;
    localStorage.setItem('c14-theme',next);
    syncTheme();
  });
  syncTheme();

  // Live network status gives the user a useful signal before a request fails.
  const status=$('#appStatus'), statusText=status?.querySelector('span');
  const setNetwork=online=>{
    if(!status)return;
    status.dataset.state=online?'online':'offline';
    if(statusText)statusText.textContent=online?'آنلاین':'بدون اتصال';
    status.title=online?'اتصال مرورگر برقرار است':'اتصال شبکه قطع شده است؛ پس از اتصال دوباره تلاش کنید';
  };
  setNetwork(navigator.onLine);
  addEventListener('online',()=>setNetwork(true));
  addEventListener('offline',()=>setNetwork(false));

  // Escape closes the current modal. Ctrl/Cmd+K is owned by one command palette below.
  addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const rootModal=$('#modalRoot');
      if(rootModal?.querySelector('.modal-backdrop')) {
        const close=rootModal.querySelector('[data-close]');
        close?.click();
      }
    }
  });

  // Submit state is managed by the existing application handlers.

  // Small visual polish for dynamically rendered family rows without changing their data.
  const observe=new MutationObserver(()=>{
    document.querySelectorAll('.family-item').forEach(item=>{
      if(item.dataset.polished)return;
      item.dataset.polished='1';
      item.setAttribute('role','button');
      item.setAttribute('tabindex','0');
      item.addEventListener('keydown',e=>{
        if((e.key==='Enter'||e.key===' ') && !e.defaultPrevented){
          e.preventDefault(); item.click();
        }
      });
    });
  });
  const list=$('#familyList');
  if(list)observe.observe(list,{childList:true,subtree:true});

  // Warn before navigating away with an open modal only; no data is changed.
  addEventListener('beforeunload',()=>{});
})();
/* Phase 3 behavior: dashboard snapshot, quick actions and resilient refresh. */
(()=>{
  const $=s=>document.querySelector(s);
  const fa=v=>new Intl.NumberFormat('fa-IR').format(v??0);
  const safeApi=async path=>{try{const r=await fetch(path,{credentials:'include'});if(!r.ok)throw 0;return await r.json()}catch{return null}};
  const setText=(id,value)=>{const el=$('#'+id);if(el)el.textContent=value==null?'—':fa(value)};
  async function refreshOverview(){
    if($('#dashboard')?.classList.contains('hidden'))return;
    const [active,archived,alerts]=await Promise.all([safeApi('/api/families?status=active'),safeApi('/api/families?status=archived'),safeApi('/api/alerts')]);
    if(active){
      setText('overviewActive',active.total);
      const families=active.families||[];
      setText('overviewUrgent',families.filter(x=>String(x.priority).includes('فوری')||x.priority==='urgent'||x.priority==='critical').length);
      const now=Date.now(),week=now+7*86400000;
      setText('overviewFollowups',families.filter(x=>{const d=x.nextFollowUp||x.nextFollowUpAt;return d&&new Date(d).getTime()>=now&&new Date(d).getTime()<=week}).length);
    }
    if(alerts){const items=alerts.alerts||alerts.items||[];setText('overviewAlerts',alerts.unread??alerts.total??items.length)}
    else if(archived){/* keep dashboard useful even when alert permission is unavailable */}
  }
  const bind=()=>{
    const actions=[['quickNewCase',()=>$('#createBtn')?.click()],['quickAdvancedSearch',()=>$('#advancedSearchBtn')?.click()],['quickOverdue',()=>$('#overdueBtn')?.click()],['quickAlerts',()=>$('#alertsBtn')?.click()]];
    actions.forEach(([id,fn])=>{const b=$('#'+id);if(b&&!b.dataset.bound){b.dataset.bound='1';b.onclick=fn}});
  };
  let overviewBusy=false;
  const guardedRefresh=async()=>{
    if(overviewBusy || $('#dashboard')?.classList.contains('hidden'))return;
    overviewBusy=true;
    try{await refreshOverview()}finally{overviewBusy=false}
  };
  const boot=()=>{bind();guardedRefresh()};
  addEventListener('familyloaded',guardedRefresh);
  const dashboard=$('#dashboard');
  if(dashboard)new MutationObserver(()=>{if(!dashboard.classList.contains('hidden'))boot()}).observe(dashboard,{attributes:true,attributeFilter:['class']});
  setTimeout(boot,900);
  setInterval(guardedRefresh,60000);
})();

(()=>{
  const $=s=>document.querySelector(s);
  const palette=$('#commandPalette'),input=$('#commandInput'),list=$('#commandList');
  const commands=[
    ['پرونده جدید','ثبت یک خانوار جدید',()=>$('#createBtn')?.click()],
    ['جست‌وجوی پیشرفته','فیلتر و جست‌وجوی دقیق',()=>$('#advancedSearchBtn')?.click()],
    ['پیگیری‌های عقب‌افتاده','مشاهده موارد موعد گذشته',()=>$('#overdueBtn')?.click()],
    ['هشدارها','بررسی هشدارهای سامانه',()=>$('#alertsBtn')?.click()],
    ['به‌روزرسانی پرونده‌ها','دریافت آخرین اطلاعات',()=>$('#refreshBtn')?.click()],
    ['تغییر پوسته','روشن / تاریک',()=>$('#themeToggle')?.click()]
  ];
  let filtered=commands,active=0;
  function render(){list.innerHTML=filtered.map((c,i)=>`<button class="command-item ${i===active?'active':''}" type="button" data-command="${i}"><b>${c[0]}</b><span>${c[1]}</span></button>`).join('');list.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>run(Number(b.dataset.command)))}
  function run(i){const c=filtered[i];if(!c)return;close();setTimeout(c[2],40)}
  function open(){if($('#dashboard')?.classList.contains('hidden'))return;palette.classList.remove('hidden');input.value='';filtered=commands;active=0;render();setTimeout(()=>input.focus(),30)}
  function close(){palette.classList.add('hidden')}
  input?.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();filtered=commands.filter(c=>(c[0]+' '+c[1]).toLowerCase().includes(q));active=0;render()});
  input?.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();active=(active+1)%Math.max(filtered.length,1);render()}else if(e.key==='ArrowUp'){e.preventDefault();active=(active-1+Math.max(filtered.length,1))%Math.max(filtered.length,1);render()}else if(e.key==='Enter'){e.preventDefault();run(active)}else if(e.key==='Escape'){e.preventDefault();close()}});
  palette?.addEventListener('click',e=>{if(e.target===palette)close()});
  addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}});
})();
