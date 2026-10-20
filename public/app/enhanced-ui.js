/* Native, dependency-free counterparts of the supplied UI components. */
(() => {
 const R=window.PersianRules,seen=new WeakSet(),loadingControls=new WeakMap();let serial=0,queued=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',success:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',warning:'<path d="M12 3 2 21h20Z M12 9v5m0 3v1"/>',destructive:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',card:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20m-16 5h4"/>',national:'<rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="8" cy="10" r="2"/><path d="M5 16h6m3-7h5m-5 5h5"/>',iban:'<path d="m3 9 9-6 9 6H3Zm2 2v7m7-7v7m7-7v7M2 21h20"/>',postal:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m2 6 10 7L22 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z"/>',mobile:'',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'};
 const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">${icons[name]||icons.info}</svg>`;
 function alertMarkup({variant='info',title='',text=''}={}){if(!['info','success','warning','destructive'].includes(variant))variant='info';return `<div class="app-alert app-alert-${variant}" role="${variant==='destructive'?'alert':'status'}">${icon(variant)}<div>${title?`<p class="app-alert-title">${esc(title)}</p>`:''}${text?`<p>${esc(text)}</p>`:''}</div></div>`;}
 function spinner(label='در حال بارگذاری',size='md'){return `<span class="app-spinner-wrap" role="status"><span class="app-spinner app-spinner-${['xs','sm','md','lg'].includes(size)?size:'md'}" aria-hidden="true"></span><span>${esc(label)}</span></span>`;}
 function loadingOverlay(region,on,label='در حال دریافت اطلاعات…'){
  region.setAttribute('aria-busy',String(on));region.querySelector(':scope > .app-loading-overlay')?.remove();
  if(on&&!loadingControls.has(region)){const states=[...region.querySelectorAll('button,input,select,textarea')].map(control=>[control,control.disabled]);loadingControls.set(region,states);states.forEach(([control])=>control.disabled=true);}else if(!on){for(const [control,disabled] of loadingControls.get(region)||[])control.disabled=disabled;loadingControls.delete(region);}
  if(on){region.classList.add('app-loading-region');const layer=document.createElement('div');layer.className='app-loading-overlay';layer.innerHTML=spinner(label);region.append(layer);}
 }
 const kinds={headNationalId:'national',memberNationalId:'national',nationalId:'national',headCardNumber:'card',cardNumber:'card',headIban:'iban',iban:'iban',postalCode:'postal',headPhone:'mobile',familyPhone:'phone',phone:'phone',mobile:'mobile'};
 const checks={national:R.national,card:R.card,iban:R.iban,postal:R.postal,phone:R.phone,mobile:R.mobile};
 const canonical=(v,kind)=>kind==='iban'?(R.normalizeIban(v)==='IR'?'':R.normalizeIban(v)):kind==='phone'||kind==='mobile'?R.normalizePhone(v):R.digits(v);
 const limits={national:10,card:16,iban:26,postal:10,phone:11,mobile:11};
 const fieldNames={national:'کد ملی',card:'شماره کارت',iban:'شماره شبا',postal:'کد پستی',phone:'شماره تلفن',mobile:'شماره همراه'};
 function validateField(input,{show=false}={}){
  const kind=input.dataset.persianKind;if(!kind)return true;
  const value=canonical(input.value,kind),valid=checks[kind](value),blank=!value;
  const legacy=['card','iban','postal'].includes(kind)&&value&&value===input.dataset.originalRaw&&!valid;
  const digits=value.replace(/^IR/,'');
  let message=blank?(input.required?'تکمیل این فیلد الزامی است.':''):valid||legacy?'':kind==='mobile'?'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.':kind==='phone'?'تلفن باید ۱۱ رقم، با صفر و کد شهر یا اپراتور باشد.':digits.length!==limits[kind]-(kind==='iban'?2:0)?`${fieldNames[kind]} باید ${R.fa(limits[kind]-(kind==='iban'?2:0))} رقم ${kind==='iban'?'بعد از IR ':''}باشد.`:`${fieldNames[kind]} معتبر نیست؛ رقم‌ها را دوباره بررسی کنید.`;
  if(kind==='national'&&valid&&input.form&&[...input.form.querySelectorAll('input[data-persian-kind="national"]')].some(other=>other!==input&&canonical(other.value,'national')===value))message='کد ملی در همین پرونده تکراری است.';
  input.setCustomValidity(message);const visible=show||input.dataset.touched==='true'||value.length>=limits[kind];
  input.setAttribute('aria-invalid',String(Boolean(message&&visible)));
  const wrap=input.closest('.app-input-wrap');wrap?.classList.toggle('is-invalid',Boolean(message&&visible));wrap?.classList.toggle('is-valid',valid&&!blank&&!message);
  const mark=wrap?.querySelector('.app-field-valid');if(mark)mark.hidden=!valid||blank||Boolean(message);
  const hint=document.getElementById(input.dataset.hintId);if(hint){hint.classList.toggle('is-error',Boolean(message&&visible));const bank=kind==='card'?R.cardBank(value):kind==='iban'?R.ibanBank(value):null;
   hint.textContent=legacy?'مقدار قبلی نیاز به بررسی دارد؛ برای اصلاح، مقدار معتبر وارد کنید.':message&&visible?message:kind==='mobile'||kind==='phone'?valid?'ساختار شماره معتبر است؛ مالکیت شماره تأیید نشده است.':kind==='mobile'?'۱۱ رقم با ۰۹؛ پیش‌شمارهٔ +۹۸ هم پذیرفته می‌شود.':'تلفن ثابت با کد شهر یا همراه؛ ۱۱ رقم با صفر.':valid?`ساختار معتبر است${bank?' · بانک '+bank:''}؛ ${kind==='card'||kind==='iban'?'مالکیت حساب تأیید نشده است.':kind==='national'?'به‌معنای تأیید هویت نیست.':'نشانی استعلام نشده است.'}`:bank?'بانک '+bank:kind==='iban'?'۲۴ رقم بعد از IR؛ بدون استعلام مالکیت':kind==='national'?'۱۰ رقم؛ صفر ابتدایی حفظ می‌شود':kind==='card'?'۱۶ رقم روی کارت؛ بدون نیاز به رمز یا CVV2':'۱۰ رقم؛ با یا بدون خط تیره';}
  return !message;
 }
 function structured(input,kind){
  if(seen.has(input))return;seen.add(input);input.dataset.persianKind=kind;input.dataset.originalRaw=canonical(input.value,kind);input.removeAttribute('maxlength');input.removeAttribute('minlength');input.removeAttribute('pattern');
  input.autocomplete=kind==='phone'||kind==='mobile'?'tel-national':kind==='card'?'cc-number':'off';input.type=kind==='phone'||kind==='mobile'?'tel':'text';input.inputMode=kind==='phone'||kind==='mobile'?'tel':'numeric';input.dir='ltr';input.spellcheck=false;
  input.placeholder={national:'۰۰۱-۲۳۴۵۶۷-۸',card:'۰۰۰۰ ۰۰۰۰ ۰۰۰۰ ۰۰۰۰',iban:'00 0000 0000 0000 0000 0000',postal:'۱۲۳۴۵-۶۷۸۹۰',phone:'۰۲۱ ۱۲۳۴ ۵۶۷۸',mobile:'۰۹۱۲ ۳۴۵ ۶۷۸۹'}[kind];
  const wrap=document.createElement('div');wrap.className='app-input-wrap app-field-'+kind;wrap.dir='ltr';input.before(wrap);wrap.innerHTML=icon(kind==='mobile'?'phone':kind);wrap.append(input);
  if(kind==='iban'){const prefix=document.createElement('span');prefix.className='app-iban-prefix';prefix.textContent='IR';wrap.insertBefore(prefix,input);}
  const mark=document.createElement('span');mark.className='app-field-valid';mark.hidden=true;mark.setAttribute('aria-hidden','true');mark.innerHTML=icon('success');wrap.append(mark);
  input.id ||= 'app-field-'+(++serial);const label=input.closest('.form-field')?.querySelector('label');if(label&&!label.htmlFor)label.htmlFor=input.id;
  const hint=document.createElement('p');hint.id=input.id+'-format-hint';hint.className='app-field-hint';hint.setAttribute('aria-live','polite');wrap.after(hint);input.dataset.hintId=hint.id;input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
  const display=(keepCaret=false)=>{
   const source=input.value,raw=canonical(source,kind),digits=kind==='iban'?raw.replace(/^IR/,''):raw;
   // Never truncate overflow, delete unexpected letters or hide invalid legacy values.
   if(!/^\d*$/.test(digits)||raw.length>limits[kind])return;
   const pos=input.selectionStart??source.length,count=R.en(source.slice(0,pos)).replace(/\D/g,'').length;
   const grouped=R.group(digits,kind);input.value=kind==='iban'?grouped:R.fa(grouped);
   if(keepCaret&&document.activeElement===input){let cursor=0,n=0;while(cursor<input.value.length&&n<count){if(/\d/.test(R.en(input.value[cursor])))n++;cursor++;}if(pos===source.length)cursor=input.value.length;input.setSelectionRange(cursor,cursor);}
  };
  input.addEventListener('beforeinput',e=>{if(e.isComposing||input.selectionStart!==input.selectionEnd)return;const pos=input.selectionStart??0;let a=pos,b=pos;if(e.inputType==='deleteContentBackward'&&/[ -]/.test(input.value[pos-1]||'!')){a=pos-2;b=pos;}else if(e.inputType==='deleteContentForward'&&/[ -]/.test(input.value[pos]||'!'))b=pos+2;else return;e.preventDefault();input.setRangeText('',Math.max(0,a),b,'end');input.dispatchEvent(new Event('input',{bubbles:true}));});
  input.addEventListener('input',e=>{if(!e.isComposing)display(true);validateField(input);});
  input.addEventListener('blur',()=>{input.dataset.touched='true';display();validateField(input,{show:true});});
  input.addEventListener('change',()=>{display();validateField(input);});display();validateField(input);
 }
 const moneyNames=new Set(['amount','approvedAmount','memberMonthlyIncome','insuranceCost','medicalMonthlyCost','debtAmount','transportationCost','utilityCost','monthlyInstallments','monthlyAid','housingDeposit','housingRent','estimatedCost','actualCost','budgetAmount']);
 const moneyRaw=v=>R.en(v).replace(/[\s,٬\u200e\u200f]/g,'');
 function validateMoney(input,{show=false}={}){
  const raw=moneyRaw(input.value);let text='';
  if(!raw)text=input.required?'مبلغ را وارد کنید.':'';
  else if(!/^\d+$/.test(raw))text='مبلغ را به‌صورت عدد صحیح و بدون علامت، اعشار یا حروف وارد کنید.';
  else {const n=BigInt(raw),min=BigInt(input.dataset.moneyMin||'0'),max=BigInt(input.dataset.moneyMax||'9007199254740991');if(n<min)text=`مبلغ نباید کمتر از ${R.fa(min.toString())} تومان باشد.`;else if(n>max)text='مبلغ از محدودهٔ مجاز بیشتر است.';}
  input.setCustomValidity(text);const visible=show||input.dataset.moneyTouched==='true';input.setAttribute('aria-invalid',String(!!text&&visible));input.closest('.app-price-input')?.classList.toggle('is-invalid',!!text&&visible);
  const hint=document.getElementById(input.dataset.moneyHint);if(hint){hint.textContent=text&&visible?text:'';hint.hidden=!(text&&visible);hint.classList.toggle('is-error',!!text&&visible);}return !text;
 }
 function priceInput(input){
  if(input.parentElement?.classList.contains("number-field")){const old=input.parentElement;old.before(input);old.remove();}
  if(seen.has(input))return;seen.add(input);input.dataset.money='toman';
  input.dataset.moneyMin=/^\d+$/.test(input.min)?input.min:'0';input.dataset.moneyMax=/^\d+$/.test(input.max)?input.max:'9007199254740991';
  input.type='text';input.inputMode='numeric';input.dir='ltr';input.autocomplete='off';input.spellcheck=false;input.removeAttribute('pattern');input.removeAttribute('maxlength');
  input.id||='app-price-'+(++serial);const field=input.closest('.form-field'),label=field?.querySelector('label');if(label&&!label.htmlFor)label.htmlFor=input.id;
  const wrap=document.createElement('div');wrap.className='app-price-input';wrap.dir='ltr';input.before(wrap);wrap.append(input);const unit=document.createElement('span');unit.className='app-price-unit';unit.textContent='تومان';wrap.append(unit);
  const hint=document.createElement('p');hint.id=input.id+'-money-hint';hint.className='app-field-hint';hint.setAttribute('aria-live','polite');wrap.after(hint);input.dataset.moneyHint=hint.id;input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
  const format=(caret=false)=>{const source=input.value,raw=moneyRaw(source);if(!/^\d*$/.test(raw))return;const pos=input.selectionStart??source.length,count=R.en(source.slice(0,pos)).replace(/\D/g,'').length;input.value=R.fa(raw.replace(/\B(?=(\d{3})+(?!\d))/g,'٬'));if(caret&&document.activeElement===input){let cursor=0,n=0;while(cursor<input.value.length&&n<count){if(/\d/.test(R.en(input.value[cursor])))n++;cursor++;}if(pos===source.length)cursor=input.value.length;input.setSelectionRange(cursor,cursor);}};
  input.addEventListener('beforeinput',e=>{if(e.isComposing||input.selectionStart!==input.selectionEnd)return;const pos=input.selectionStart??0;let a=pos,b=pos;if(e.inputType==='deleteContentBackward'&&input.value[pos-1]==='٬')a=pos-2;else if(e.inputType==='deleteContentForward'&&input.value[pos]==='٬')b=pos+2;else return;e.preventDefault();input.setRangeText('',Math.max(0,a),b,'end');input.dispatchEvent(new Event('input',{bubbles:true}));});
  input.addEventListener('input',e=>{if(!e.isComposing)format(true);validateMoney(input);});input.addEventListener('change',()=>{format();validateMoney(input);});input.addEventListener('blur',()=>{input.dataset.moneyTouched='true';format();validateMoney(input,{show:true});});format();validateMoney(input);
 }
 function address(form){
  const province=form.querySelector('[data-address-province]'),city=form.querySelector('[data-address-city]');if(!province||!city||seen.has(province))return;seen.add(province);seen.add(city);
  const initial={province:province.value,city:city.value},data=window.IranDivisions;
  const make=(input,options)=>{const list=document.createElement('datalist');list.id='app-address-'+(++serial);input.setAttribute('list',list.id);input.after(list);list.replaceChildren(...options.map(value=>{const o=document.createElement('option');o.value=value;return o;}));return list;};
  make(province,Object.keys(data));const cities=make(city,[]);
  const help=document.createElement('p');help.className='app-field-hint';help.textContent='شهر از فهرست استان انتخاب شود؛ برای روستا، شهر مرتبط و نام آبادی را جدا ثبت کنید.';city.after(help);
  const find=()=>Object.keys(data).find(p=>R.normalizeName(p)===R.normalizeName(province.value));
  const validate=()=>{const p=find(),c=p&&data[p].find(c=>R.normalizeName(c)===R.normalizeName(city.value));const unchanged=province.value===initial.province&&city.value===initial.city;
   province.setCustomValidity(!province.value&&!city.value||p||unchanged?'':'استان را از فهرست انتخاب کنید.');city.setCustomValidity(!province.value&&!city.value||p&&c||unchanged?'':'شهر معتبرِ همین استان را انتخاب کنید.');
   city.disabled=!province.value;city.placeholder=province.value?'انتخاب شهر':'ابتدا استان را انتخاب کنید';return {p,c};};
  const populate=()=>{const p=find();cities.replaceChildren(...(data[p]||[]).map(value=>{const o=document.createElement('option');o.value=value;return o;}));validate();};
  province.addEventListener('input',validate);city.addEventListener('input',validate);
  let last=province.value;province.addEventListener('change',()=>{const p=find();if(p)province.value=p;if(province.value!==last){city.value='';city.dispatchEvent(new Event('input',{bubbles:true}));last=province.value;}populate();});
  city.addEventListener('change',()=>{const {c}=validate();if(c)city.value=c;validate();});populate();
 }
 function timeInput(input){
  if(seen.has(input))return;seen.add(input);input.dataset.enhancedTime='true';input.step='60';
  const wrap=document.createElement('div');wrap.className='app-time-wrap';input.before(wrap);wrap.innerHTML=icon('clock');wrap.append(input);input.dir='ltr';
  const now=document.createElement('button');now.type='button';now.className='secondary';now.textContent='الان';now.setAttribute('aria-label','انتخاب ساعت فعلی تهران');wrap.append(now);
  const clear=document.createElement('button');clear.type='button';clear.className='secondary';clear.textContent='پاک‌کردن';wrap.append(clear);
  const validate=()=>{input.setCustomValidity(input.value&&(!R.time(input.value)||input.min&&input.value<input.min||input.max&&input.value>input.max)?'ساعت باید در بازهٔ مجاز باشد.':'');now.disabled=input.disabled;clear.disabled=input.disabled;};
  now.onclick=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());let t=parts.find(p=>p.type==='hour').value+':'+parts.find(p=>p.type==='minute').value;if(input.min&&t<input.min)t=input.min;if(input.max&&t>input.max)t=input.max;input.value=t;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};input.addEventListener('input',validate);validate();
 }
 function table(table){
  if(seen.has(table))return;seen.add(table);table.classList.add('app-table');table.querySelectorAll('thead th').forEach(th=>{if(!th.hasAttribute('scope'))th.scope='col';});
  if(!table.parentElement.matches('.fi-table-scroll,.table-scroll,.app-table-scroll')){const wrapper=document.createElement('div');wrapper.className='app-table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',table.caption?.textContent||'جدول؛ برای مشاهدهٔ ستون‌های دیگر افقی پیمایش کنید');table.before(wrapper);wrapper.append(table);}
  table.querySelectorAll('td').forEach(td=>{if(/^[\s\d۰-۹٠-٩٬،٫.\-]+(?:تومان|ریال|٪)?$/.test(td.textContent))td.classList.add('app-numeric');});
 }
 function scan(){
  queued=false;document.querySelectorAll('input').forEach(input=>{const kind=input.dataset.persianKind||kinds[input.name]||(input.type==='tel'?'phone':null);if(kind&&input.type!=='hidden'&&!input.closest('[role=search],#fiFilters')&&!/search/i.test(input.id))structured(input,kind);else if(input.dataset.money||moneyNames.has(input.name)||input.classList.contains('money-input'))priceInput(input);else if(input.type==='time')timeInput(input);});
  document.querySelectorAll('form:has([data-address-province])').forEach(address);document.querySelectorAll('table').forEach(table);
  document.querySelectorAll('.panel-loading').forEach(node=>{if(!node.querySelector('.app-spinner'))node.innerHTML=spinner(node.textContent.trim()||'در حال بارگذاری…');});
  document.querySelectorAll('.message:not(:empty)').forEach(node=>{if(node.querySelector('.app-alert'))return;const text=node.textContent.trim();if(text)node.innerHTML=alertMarkup({variant:node.classList.contains('error')?'destructive':node.classList.contains('success')?'success':'info',text});});
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(scan);}
 window.EnhancedUI=Object.freeze({alertMarkup,spinner,loadingOverlay,validateField,validateMoney,moneyRaw,scan,icon,esc});
 AppLifecycle.subscribe('enhanced-ui',schedule);document.addEventListener('DOMContentLoaded',scan);
 document.addEventListener('formdata',e=>{const form=e.target;if(!(form instanceof HTMLFormElement))return;const names=new Set([...form.querySelectorAll('input[data-money][name]')].map(i=>i.name));for(const name of names){const values=e.formData.getAll(name);if(!values.length)continue;e.formData.delete(name);for(const value of values)e.formData.append(name,typeof value==='string'?moneyRaw(value):value);}},true);
 document.addEventListener('formdata',e=>{const form=e.target;if(!(form instanceof HTMLFormElement))return;const names=new Map([...form.querySelectorAll('input[data-persian-kind][name]')].map(input=>[input.name,input.dataset.persianKind]));for(const [name,kind] of names){const values=e.formData.getAll(name);if(!values.length)continue;e.formData.delete(name);for(const value of values)e.formData.append(name,typeof value==='string'?canonical(value,kind):value);}},true);
 document.addEventListener('invalid',e=>{if(e.target?.dataset?.persianKind)validateField(e.target,{show:true});else if(e.target?.dataset?.money)validateMoney(e.target,{show:true});},true);
})();
