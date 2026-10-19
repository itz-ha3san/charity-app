/* Financial intelligence: local, auditable explanations; no family data sent to third parties.
   RTL/number/interaction conventions inspired by vibefarsi.ir/components/chart.
   Original vanilla implementation; does not copy or require React components. */
(() => {
  const fmt = v => BigInt(v).toLocaleString('fa-IR');
  const cash = v => v === null || v === undefined ? 'داده کافی نیست' : fmt(v) + ' تومان';
  const period = p => Number(p.year).toLocaleString('fa-IR', {useGrouping:false}) + '/' + String(p.month).padStart(2,'0').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
  const compact = v => {
    v=BigInt(v);
    if(v>=1000000000000000n){const exponent=v.toString().length-1,base=10n**BigInt(exponent),fraction=v%base*10n/base;return fmt(v/base)+(fraction?'٫'+fmt(fraction):'')+'×۱۰^'+fmt(exponent);}
    for(const [unit,label] of [[1000000000000n,'تریلیون'],[1000000000n,'میلیارد'],[1000000n,'میلیون'],[1000n,'هزار']])if(v>=unit){const fraction=v%unit*10n/unit;return fmt(v/unit)+(fraction?'٫'+fmt(fraction):'')+' '+label;}
    return fmt(v);
  };
  // UI equivalents of the supplied Stat/BarChart/LineChart/Sparkline components.
  // Amounts remain BigInt; only bounded pixel ratios are converted to Number.
  function percentChange(current, previous) {
    if(current===null || current===undefined || previous===null || previous===undefined || BigInt(previous)<=0n)return null;
    const diff=BigInt(current)-BigInt(previous), absolute=diff<0n?-diff:diff;
    return {direction:diff>0n?'up':diff<0n?'down':'flat', basisPoints:(absolute*10000n+BigInt(previous)/2n)/BigInt(previous)};
  }
  function deltaMarkup(delta, comparison) {
    if(!delta)return '';
    const bp=delta.basisPoints, decimal=String(bp%100n).padStart(2,'0').replace(/0+$/,'');
    const value=delta.direction!=='flat'&&bp===0n?'کمتر از ۰٫۰۱٪':fmt(bp/100n)+(decimal?'٫'+decimal.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]):'')+'٪';
    const description=(delta.direction==='up'?'افزایش':delta.direction==='down'?'کاهش':'بدون تغییر')+' '+value+' '+comparison;
    const path=delta.direction==='up'?'M17 17 7 7M7 17V7h10':delta.direction==='down'?'M17 7 7 17M7 7v10h10':'M5 12h14';
    return `<span class="fi-stat-delta fi-delta-${delta.direction}" title="${esc(description)}" aria-label="${esc(description)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><bdi>${esc(value)}</bdi></span>`;
  }
  function sparkline(data) {
    const values=data.filter(v=>v!==null).map(BigInt);
    if(!values.length || data.length<2)return '';
    const max=values.reduce((m,v)=>v>m?v:m,1n), x=i=>118-i/(data.length-1)*116, y=v=>30-Number(BigInt(v)*10000n/max)/10000*26;
    const runs=[];let run=[];
    data.forEach((v,i)=>{if(v===null){if(run.length)runs.push(run);run=[];}else run.push([x(i),y(v)]);});if(run.length)runs.push(run);
    return `<svg class="fi-sparkline" viewBox="0 0 120 32" aria-hidden="true" focusable="false">${runs.map(r=>r.length===1?`<circle cx="${r[0][0]}" cy="${r[0][1]}" r="2"/>`:`<polyline points="${r.map(p=>p.join(',')).join(' ')}"/>`).join('')}</svg>`;
  }
  function statCard({label,value,unit='',note='',delta=null,comparison='',trend=null,size='md',valueText=null}) {
    const present=value!==null&&value!==undefined;
    return `<article class="fi-stat fi-stat-${size}"><p class="fi-stat-label">${esc(label)}</p><div class="fi-stat-row"><p class="fi-stat-value"><bdi>${esc(valueText!==null?valueText:present?fmt(value):'داده کافی نیست')}</bdi>${present&&unit?`<span class="fi-stat-unit">${esc(unit)}</span>`:''}</p>${deltaMarkup(delta,comparison)}</div>${trend?sparkline(trend):''}${note?`<p class="fi-stat-note">${esc(note)}</p>`:''}${delta&&comparison?`<p class="fi-stat-comparison">${esc(comparison)}</p>`:''}</article>`;
  }
  let chartSequence=0;
  function monthlyChart(monthly, metric, measuredWidth, kind='bar') {
    const available=monthly.filter(m=>m[metric]!==null);
    if(!available.length)return '<div class="fi-empty">هنوز پرداختی در این بازه ثبت نشده است.</div>';
    const maximum=available.reduce((n,m)=>BigInt(m[metric])>n?BigInt(m[metric]):n,1n);
    const rough=(maximum+3n)/4n,power=10n**BigInt(rough.toString().length-1),step=[1n,2n,5n,10n].map(n=>n*power).find(n=>n>=rough),top=((maximum+step-1n)/step)*step;
    const width=measuredWidth||Math.min(1000,Math.max(240,innerWidth-100)),mobile=width<600,H=280,left=mobile?12:28,right=mobile?90:150,plot=width-left-right,slot=plot/monthly.length;
    const y=v=>226-Number(BigInt(v)*10000n/top)/10000*194, x=i=>width-right-(i+.5)*slot;
    const label=v=>metric==='amount'?cash(v):fmt(v)+' پرداخت';
    const tickValues=[];for(let v=0n;v<=top;v+=step)tickValues.push(v);
    const grid=tickValues.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="fi-gridline"/><text x="${width-right+12}" y="${y(v)+5}" font-size="13">${esc(compact(v))}</text>`).join('');
    const ticks=monthly.map((m,i)=>`<text x="${x(i)}" y="252" text-anchor="middle" font-size="13">${!mobile||i%3===0||i===monthly.length-1?esc(String(m.month).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])):''}</text>`).join('');
    const gradient='fi-area-'+(++chartSequence);
    let lines='';
    if(kind==='line') {
      const runs=[];let run=[];
      monthly.forEach((m,i)=>{if(m[metric]===null){if(run.length)runs.push(run);run=[];}else run.push([x(i),y(m[metric])]);});if(run.length)runs.push(run);
      lines=`<defs><linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--blue,#2783de)" stop-opacity=".22"/><stop offset="1" stop-color="var(--blue,#2783de)" stop-opacity=".02"/></linearGradient></defs>`+runs.filter(r=>r.length>1).map(r=>{
        const path=r.map(([px,py],i)=>i===0?`M ${px} ${py}`:`C ${(r[i-1][0]+px)/2} ${r[i-1][1]}, ${(r[i-1][0]+px)/2} ${py}, ${px} ${py}`).join(' ');
        return `<path d="${path} L ${r.at(-1)[0]} 226 L ${r[0][0]} 226 Z" fill="url(#${gradient})"/><path class="fi-line" d="${path}"/>`;
      }).join('');
    }
    const marks=monthly.map((m,i)=> {
      if(m[metric]===null)return `<text x="${x(i)}" y="218" text-anchor="middle" font-size="14">—</text>`;
      const value=m[metric],full=period(m)+': '+label(value),bw=Math.min(48,slot*.6),latest=i===monthly.length-1;
      return `<g class="fi-point${latest?' fi-latest':''}" tabindex="0" role="img" aria-label="${esc(full)}" data-fi-point="${i}" data-heading="${esc(period(m))}" data-value="${esc(label(value))}" data-x="${x(i)}"><title>${esc(full)}</title><rect x="${x(i)-slot/2}" y="24" width="${slot}" height="206" fill="transparent"/>${kind==='line'?`<circle class="fi-dot" cx="${x(i)}" cy="${y(value)}" r="4"/>`:`<rect x="${x(i)-bw/2}" y="${y(value)}" width="${bw}" height="${Math.max(0,226-y(value))}" rx="4" class="fi-bar"/>`}</g>`;
    }).join('');
    return `<div class="fi-plot-scroll" aria-label="نمودار پرداخت ماهانه؛ مقادیر دقیق در جدول زیر"><svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="group" aria-label="${kind==='line'?'نمودار خطی':'نمودار میله‌ای'} ${metric==='amount'?'مبلغ پرداخت نقدی، تومان':'تعداد پرداخت'} در دوازده ماه کامل گذشته؛ ماه‌های فاقد سابقه با خط تیره مشخص‌اند"><title>${metric==='amount'?'مبلغ پرداخت نقدی به تومان':'تعداد پرداخت'}</title>${grid}${lines}<line class="fi-guide" x1="0" x2="0" y1="24" y2="226" hidden/>${marks}${ticks}</svg><div class="fi-tooltip" hidden><strong></strong><span></span></div></div><p class="fi-note">محور افقی: ماه شمسی، از راست به چپ، قدیم به جدید؛ در موبایل فقط بخشی از برچسب ماه‌ها نمایش داده می‌شود. سال و مقدار دقیق در جدول زیر؛ — یعنی پیش از نخستین سابقه، نه صفر. ${metric==='amount'?'محور عمودی: تومان.':''} ${kind==='line'?'خط فقط ماه‌های دارای سابقه را به هم متصل می‌کند.':''}</p>`;
  }
  function bindChartTooltip(chartBox) {
    const plot=chartBox.querySelector('.fi-plot-scroll'),tooltip=chartBox.querySelector('.fi-tooltip'),guide=chartBox.querySelector('.fi-guide');
    if(!plot||!tooltip)return;
    function hide(){tooltip.hidden=true;guide.setAttribute('hidden','');plot.querySelectorAll('.is-active').forEach(p=>p.classList.remove('is-active'));}
    function show(point){if(!point)return;hide();point.classList.add('is-active');tooltip.querySelector('strong').textContent=point.dataset.heading;tooltip.querySelector('span').textContent=point.dataset.value;tooltip.hidden=false;const width=tooltip.offsetWidth;tooltip.style.left=Math.max(8,Math.min(plot.clientWidth-width-8,Number(point.dataset.x)-width/2))+'px';guide.setAttribute('x1',point.dataset.x);guide.setAttribute('x2',point.dataset.x);guide.removeAttribute('hidden');}
    plot.onpointerover=e=>show(e.target.closest('[data-fi-point]'));
    plot.onpointerleave=()=>{const focused=plot.querySelector('[data-fi-point]:focus');if(focused)show(focused);else hide();};
    plot.addEventListener('focusin',e=>show(e.target.closest('[data-fi-point]')));
    plot.addEventListener('focusout',hide);
    plot.onclick=e=>show(e.target.closest('[data-fi-point]'));
    plot.onkeydown=e=>{if(e.key==='Escape'){if(!tooltip.hidden){e.preventDefault();e.stopPropagation();}hide();return;}if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const points=[...plot.querySelectorAll('[data-fi-point]')],i=points.indexOf(document.activeElement),next=points[i+(e.key==='ArrowLeft'?1:-1)];if(i>=0){e.preventDefault();next?.focus();}};
  }
  window.AppFinancialVisuals=Object.freeze({percentChange,sparkline,statCard,monthlyChart});
  window.openFinancialIntelligence = async function(filters = {}) {
    const previous = document.activeElement;
    const root = AppUI.mountModal(`<div class="modal-backdrop"><section class="modal fi-modal"><div class="modal-head"><div class="fi-heading"><img src="/brand/charity-logo.png" alt="نشان خیریه"><div><div class="eyebrow">تصمیم روشن، حمایت ماندگار</div><h2>داشبورد مالی هوشمند</h2></div></div><button class="close-btn" type="button" data-close aria-label="بستن">×</button></div><div id="fiContent" aria-live="polite" aria-busy="true">در حال محاسبه از پرداخت‌های ثبت‌شده…</div></section></div>`);
    if(!root)return;
    const box=root.querySelector('#fiContent');
    const close=()=>{closeModal();previous?.focus?.();};root.querySelector('[data-close]').onclick=close;
    try {
      const qs=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
      const [d, funds]=await Promise.all([api('/api/financial-analytics?'+qs),api('/api/funds')]);
      if(!box.isConnected)return;
      const f=d.forecast, allMonths=d.monthly.filter(m=>m.amount!==null), latest=allMonths.at(-1), back=f.lastBacktest;
      const beforeLatest=d.monthly.at(-2), monthlyDelta=percentChange(d.monthly.at(-1)?.amount,beforeLatest?.amount);
      const comparison=beforeLatest?'نسبت به '+period(beforeLatest):'';
      const cards=[
        statCard({label:'پرداخت در ۱۲ ماه کامل گذشته',value:d.totalPaid,unit:'تومان',note:'فقط سوابق نقدی در فیلتر فعلی'}),
        statCard({label:'آخرین ماه کامل · '+period(d.monthly.at(-1)),value:latest?.amount??null,unit:'تومان',delta:monthlyDelta,comparison,trend:d.monthly.map(m=>m.amount),note:monthlyDelta?'روند پرداخت ماه‌های کامل؛ افزایش لزوماً بهتر نیست.':beforeLatest?.amount==='0'?'مبنای مقایسه صفر است؛ درصد محاسبه نمی‌شود.':'برای درصد تغییر، سابقه دو ماه کامل لازم است.'}),
        statCard({label:'ماه جاری · '+period(d.current),value:d.current.amount,unit:'تومان',note:'ماه ناقص؛ بدون مقایسه با ماه کامل'}),
        statCard({label:'تعهد تأییدشده ماه آینده',value:d.committed,unit:'تومان',valueText:d.committed===null?'بدون تخصیص صندوق':null,note:'درخواست تاریخ‌دار، فعال و پرداخت‌نشده'})
      ].join('');
      const summary = !f.available ? 'برای برآورد، حداقل سه ماه کامل دارای پرداخت لازم است. فعلاً ارقام واقعی و تعهدات قطعی را ببینید.' : `برآورد ${period(d.next)} با ${f.method==='mean_3'?'میانگین سه ماه اخیر':'مبلغ ماه قبل'} محاسبه شده است. ${f.backtestMonths?`خطای مطلق میانگین در ${fmt(f.backtestMonths)} ماه آزمون گذشته: ${cash(f.mae)}.`:'هنوز ماه آزمون کافی برای سنجش خطا وجود ندارد؛ این برآورد اولیه است.'}`;
      box.innerHTML=`<p class="fi-intro">دریافتی نقدی خانواده‌ها و برآورد ماه آینده، با اعداد قابل پیگیری. هیچ داده‌ای به سرویس هوش مصنوعی بیرونی ارسال نمی‌شود.</p><form id="fiFilters" class="fi-filters"><label>شماره پرونده برای جست‌وجو<input name="familySearch" maxlength="80" placeholder="مثلاً ۶۱۰"></label><button type="button" id="fiFamilySearch" class="secondary">جست‌وجوی پرونده</button><label>خانواده<select name="familyId"><option value="">همه خانواده‌های مجاز</option>${filters.familyId?`<option value="${esc(filters.familyId)}" selected>پرونده انتخاب‌شده</option>`:''}</select></label><label>صندوق<select name="fundId"><option value="">همه صندوق‌ها</option>${funds.funds.map(x=>`<option value="${esc(x.id)}" ${filters.fundId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>نوع حمایت<select name="category"><option value="">همه انواع</option>${["لوازم آموزشی","بهداشت و درمان","بیمه","کلاس آموزشی","خرید لوازم منزل","معیشت","قسط","اهدایی","مسکن","درمان","تحصیل","خوراک","اشتغال","کمک نقدی","سایر"].map(c=>`<option value="${esc(c)}" ${filters.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>بایگانی<select name="archive"><option value="all">همه سوابق</option><option value="active" ${filters.archive==='active'?'selected':''}>فعال‌ها</option><option value="archived" ${filters.archive==='archived'?'selected':''}>بایگانی‌شده‌ها</option></select></label><button type="submit" class="primary">اعمال فیلتر</button><span id="fiSearchStatus" role="status"></span></form><div class="fi-metrics fi-summary-metrics">${cards}</div><section class="fi-panel"><header><div><h3>${filters.familyId?'دریافتی خانواده انتخاب‌شده':'پرداخت به خانواده‌ها'}</h3><p>${period(d.monthly[0])} تا ${period(d.monthly.at(-1))} · دوره حسابداری پرداخت</p></div><div class="fi-chart-controls"><div class="fi-segments" role="group" aria-label="نوع نمودار"><button type="button" data-fi-kind="bar" aria-pressed="true">میله‌ای</button><button type="button" data-fi-kind="line" aria-pressed="false">خطی</button></div><div class="fi-segments" role="group" aria-label="معیار نمودار"><button type="button" data-fi-metric="amount" aria-pressed="true">مبلغ</button><button type="button" data-fi-metric="payments" aria-pressed="false">تعداد</button></div></div></header><div id="fiChart">${monthlyChart(d.monthly,'amount')}</div><details><summary>جدول دقیق و قابل دسترس نمودار</summary><div class="fi-table-scroll"><table><caption>دریافتی نقدی خانواده‌ها؛ واحد مبلغ تومان</caption><thead><tr><th scope="col">ماه</th><th scope="col">مبلغ</th><th scope="col">تعداد پرداخت</th></tr></thead><tbody>${d.monthly.map(m=>`<tr><th scope="row">${period(m)}</th><td>${m.amount===null?'بدون سابقه':cash(m.amount)}</td><td>${m.payments===null?'—':fmt(m.payments)}</td></tr>`).join('')}</tbody></table></div></details></section><section class="fi-panel fi-forecast"><div class="eyebrow">برآورد قابل توضیح · ${period(d.next)}</div><h3>برای ماه آینده چه مقدار آماده باشیم؟</h3><p>${esc(summary)}</p><div class="fi-metrics">${[{label:'سناریوی کم‌هزینه',value:d.plan.low},{label:'برآورد مرکزی',value:d.plan.likely},{label:'سناریوی پرهزینه',value:d.plan.high}].map(c=>statCard({...c,unit:'تومان',size:'sm'})).join('')}</div><p class="fi-note">بازه، سناریوی برنامه‌ریزی بر اساس بیشترین خطای تاریخی است؛ بازه اطمینان آماری نیست. تعهد قطعی با برآورد جمع نشده و فقط کف سناریوهاست. مبالغ تعهدی بدون تاریخ مشخص یا ماه‌های دیگر در آن نیستند.</p>${back?`<p>آزمون ماه قبل (${latest?period(latest):''}): برآورد ${cash(back.predicted)}؛ واقعی ${cash(back.actual)}. انتخاب روش با آزمون‌های گذشته انجام شده و ارزیابی مستقل آینده هنوز موجود نیست.</p>`:''}<label class="fi-scenario">فرض تغییر هزینه نسبت به سناریوی مرکزی (درصد)<input id="fiScenario" type="number" min="-100" max="300" step="1" value="0" ${f.available?'':'disabled'}></label><p id="fiScenarioResult" role="status">شبیه‌سازی، داده واقعی را تغییر نمی‌دهد.</p></section><section class="fi-panel"><h3>تفکیک نوع حمایت</h3><p class="fi-note">برآورد هر دسته مستقل است؛ دسته‌های کم‌سابقه بدون عدد می‌مانند و جمع پیش‌بینی دسته‌ها الزاماً برابر مدل کل نیست.</p><p class="fi-note fi-mobile-hint">برای دیدن سایر ستون‌ها، جدول را افقی پیمایش کنید.</p><div class="fi-table-scroll"><table><thead><tr><th scope="col">نوع حمایت</th><th scope="col">پرداخت ۱۲ ماه کامل</th><th scope="col">برآورد خام ماه آینده</th><th scope="col">تعهد ماه آینده</th></tr></thead><tbody>${d.categories.map(c=>`<tr><th scope="row">${esc(c.category)}</th><td>${cash(c.paid)}</td><td>${cash(c.forecast.available?c.forecast.estimate:null)}</td><td>${d.committed===null?'نامشخص برای صندوق':cash(c.committed)}</td></tr>`).join('')||'<tr><td colspan="4">هنوز سابقه‌ای ثبت نشده است.</td></tr>'}</tbody></table></div></section><details class="fi-panel"><summary>روش محاسبه، محدودیت‌ها و حریم خصوصی</summary><p>${esc(d.methodology.warning)}</p><ul><li>داده: پرداخت‌های ثبت‌شده با دوره شمسی حسابداری؛ نه تاریخ ثبت یا تراکنش بانکی.</li><li>ماه جاری وارد آموزش نمی‌شود. ماه‌های قبل از نخستین سابقه ناشناخته‌اند؛ پس از آن صفر فقط یعنی پرداخت ثبت‌شده‌ای نیست.</li><li>انتخاب بین میانگین سه ماهه و ماه قبل با خطای آزمون غلتان گذشته است. تورم، فصل و درآمد خیریه مدل نشده‌اند.</li><li>دریافتی غیرنقدی، بودجه صندوق و وعده کمک، درآمد وصول‌شده محسوب نمی‌شوند.</li><li>این نسخه موتور آماری و توضیح قاعده‌محور دارد، نه مدل زبانی متصل. تصمیم پرداخت و اولویت خانواده با انسان است.</li></ul><p>زمان محاسبه: ${esc(new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(d.generatedAt)))}</p></details>`;
      box.setAttribute('aria-busy','false');
      let activeMetric='amount', activeKind='bar', lastWidth=0;
      const chartBox=box.querySelector('#fiChart');
      const drawChart=()=>{const width=Math.max(200,Math.floor(chartBox.clientWidth));lastWidth=width;chartBox.innerHTML=monthlyChart(d.monthly,activeMetric,width,activeKind);bindChartTooltip(chartBox);};
      const resizeObserver=new ResizeObserver(()=>{if(box.isConnected&&Math.floor(chartBox.clientWidth)!==lastWidth)drawChart();});
      resizeObserver.observe(chartBox);drawChart();
      const unsubscribe=AppLifecycle.subscribe('financial-intelligence-'+AppUI.requestKey(),()=>{if(!box.isConnected){resizeObserver.disconnect();unsubscribe();}});
      root.querySelectorAll('[data-fi-metric]').forEach(b=>b.onclick=()=>{activeMetric=b.dataset.fiMetric;root.querySelectorAll('[data-fi-metric]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawChart();});
      root.querySelectorAll('[data-fi-kind]').forEach(b=>b.onclick=()=>{activeKind=b.dataset.fiKind;root.querySelectorAll('[data-fi-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawChart();});
      const form=box.querySelector('#fiFilters');
      form.onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(form));delete values.familySearch;window.openFinancialIntelligence(values);};
      box.querySelector('#fiFamilySearch').onclick=async()=>{
        const btn=box.querySelector('#fiFamilySearch'),status=box.querySelector('#fiSearchStatus');btn.disabled=true;
        try{const v=form.elements.familySearch.value.replace(/[۰-۹٠-٩]/g,n=>String('۰۱۲۳۴۵۶۷۸۹'.includes(n)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(n):'٠١٢٣٤٥٦٧٨٩'.indexOf(n)));const r=await api('/api/financial-analytics/families?q='+encodeURIComponent(v));form.elements.familyId.innerHTML='<option value="">همه خانواده‌های مجاز</option>'+r.families.map(f=>`<option value="${esc(f.id)}">پرونده ${esc(f.caseNumber)}${f.archived?' · بایگانی':''}</option>`).join('');status.textContent=r.families.length?`${fmt(r.families.length)} نتیجه؛ پرونده را انتخاب و فیلتر را اعمال کنید. حداکثر ۳۰ نتیجه.`:'پرونده‌ای پیدا نشد.';}catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
      };
      box.querySelector('#fiScenario').oninput=e=>{const v=Number(e.target.value),target=box.querySelector('#fiScenarioResult');target.textContent=!f.available||!Number.isInteger(v)||v < -100||v > 300?'درصد صحیح بین منفی ۱۰۰ تا ۳۰۰ وارد کنید.':`سناریوی فرضی: ${cash(BigInt(d.plan.likely)*BigInt(100+v)/100n)}. فقط شبیه‌سازی؛ بدون تغییر داده‌ها.`;};
    }catch(e){if(box.isConnected){box.textContent='دریافت تحلیل ممکن نشد: '+e.message;box.setAttribute('aria-busy','false');}}
  };
})();
