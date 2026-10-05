(() => {
  const icon = (name) => ({
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14"/></svg>'
  })[name];
  const fa = v => String(v ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const en = v => String(v ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  function enhanceSelect(select) {
    if (!select || select.dataset.controlEnhanced || select.closest('.number-field')) return;
    select.dataset.controlEnhanced = 'true';
    const wrap = document.createElement('div'); wrap.className = 'select-control';
    select.parentNode.insertBefore(wrap, select); wrap.append(select);
    const chev = document.createElement('span'); chev.className = 'select-chevron'; chev.innerHTML = icon('chevron'); wrap.append(chev);
  }

  function enhanceNumber(input) {
    if (!input || input.dataset.controlEnhanced || input.type !== 'number') return;
    input.dataset.controlEnhanced = 'true';
    const wrap = document.createElement('div'); wrap.className = 'number-field';
    input.parentNode.insertBefore(wrap, input);
    const plus = document.createElement('button'), minus = document.createElement('button');
    for (const [b, n, label] of [[plus,'plus','افزایش'],[minus,'minus','کاهش']]) { b.type='button'; b.className='number-step'; b.setAttribute('aria-label',label); b.innerHTML=icon(n); }
    wrap.append(plus,input,minus);
    const value = () => Number(en(input.value || '0')) || 0;
    const limit = n => Math.min(input.max === '' ? Infinity : Number(input.max), Math.max(input.min === '' ? -Infinity : Number(input.min), n));
    const set = n => { input.value = String(limit(n)); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); sync(); };
    const sync = () => { const n=value(); plus.disabled=input.disabled || (input.max!=='' && n>=Number(input.max)); minus.disabled=input.disabled || (input.min!=='' && n<=Number(input.min)); };
    plus.onclick=()=>set(value()+Number(input.step||1)); minus.onclick=()=>set(value()-Number(input.step||1)); input.addEventListener('input',sync); sync();
  }

  const comboMap = new Map();
  function enhanceCombobox(input, options=[]) {
    if (!input) return null;
    if (comboMap.has(input)) { comboMap.get(input).setOptions(options); return comboMap.get(input); }
    const root=document.createElement('div'); root.className='combobox'; root.dataset.open='false';
    input.parentNode.insertBefore(root,input);
    const frame=document.createElement('div'); frame.className='combobox-frame'; root.append(frame); frame.append(input); input.classList.add('combobox-input');
    const chev=document.createElement('span'); chev.className='combobox-chevron'; chev.innerHTML=icon('chevron'); frame.append(chev);
    const list=document.createElement('ul'); list.className='combobox-panel'; list.hidden=true; list.id='combo-'+Math.random().toString(36).slice(2); list.setAttribute('role','listbox'); document.body.append(list);
    input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-controls',list.id); input.setAttribute('aria-expanded','false');
    let all=[...new Set(options)], filtered=[], index=0;
    const position=()=>{const r=root.getBoundingClientRect(); list.style.left=r.left+'px'; list.style.top=(r.bottom+4)+'px'; list.style.width=r.width+'px';};
    const close=()=>{root.dataset.open='false'; input.setAttribute('aria-expanded','false'); list.hidden=true;};
    const open=()=>{root.dataset.open='true'; input.setAttribute('aria-expanded','true'); position(); list.hidden=false; render();};
    const pick=v=>{input.value=v; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); close();};
    const render=()=>{const q=input.value.trim(); const starts=all.filter(x=>x.startsWith(q)), contains=all.filter(x=>!x.startsWith(q)&&x.includes(q)); filtered=q?[...starts,...contains]:all; index=Math.max(0,Math.min(index,filtered.length-1)); list.innerHTML=''; if(!filtered.length){const li=document.createElement('li');li.className='combobox-empty';li.textContent='چیزی پیدا نشد';list.append(li);return;} filtered.forEach((o,i)=>{const li=document.createElement('li');li.className='combobox-option';li.dataset.active=String(i===index);li.setAttribute('role','option');li.setAttribute('aria-selected',String(o===input.value)); const text=document.createElement('span'); if(q&&o.startsWith(q)){const m=document.createElement('mark');m.textContent=q;text.append(m,document.createTextNode(o.slice(q.length)));}else text.textContent=o;li.append(text);if(o===input.value){const c=document.createElement('span');c.className='combobox-check';c.innerHTML=icon('check');li.append(c);}li.onpointerenter=()=>{index=i;render();};li.onmousedown=e=>{e.preventDefault();pick(o);};list.append(li);});};
    input.addEventListener('focus',open); input.addEventListener('input',()=>{index=0;open();}); input.addEventListener('blur',()=>setTimeout(close,120));
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();index=Math.min(filtered.length-1,index+1);render();}if(e.key==='ArrowUp'){e.preventDefault();index=Math.max(0,index-1);render();}if(e.key==='Enter'&&root.dataset.open==='true'&&filtered[index]){e.preventDefault();pick(filtered[index]);}if(e.key==='Escape')close();});
    addEventListener('resize',()=>root.dataset.open==='true'&&position(),{passive:true}); addEventListener('scroll',()=>root.dataset.open==='true'&&position(),true);
    const api={setOptions(v){all=[...new Set(v.filter(Boolean))];if(root.dataset.open==='true')render();},destroy(){list.remove();root.replaceWith(input);comboMap.delete(input);}}; comboMap.set(input,api); return api;
  }

  function createOtp(root,{length=6,value='',size='md',onChange,onComplete,disabled=false}={}) {
    root.classList.add('otp-field'); root.dataset.size=size; root.dir='ltr'; root.setAttribute('role','group'); root.setAttribute('aria-label',root.getAttribute('aria-label')||'کد تأیید'); let code=en(value).replace(/\D/g,'').slice(0,length); const refs=[];
    const commit=next=>{code=en(next).replace(/\D/g,'').slice(0,length); refs.forEach((x,i)=>x.value=code[i]?fa(code[i]):''); onChange?.(code); if(code.length===length)onComplete?.(code); refs[Math.min(code.length,length-1)]?.focus();};
    root.innerHTML=''; Array.from({length},(_,i)=>{const x=document.createElement('input');x.className='otp-box';x.inputMode='numeric';x.autocomplete=i===0?'one-time-code':'off';x.disabled=disabled;x.value=code[i]?fa(code[i]):'';x.oninput=e=>{const typed=en(e.target.value).replace(/\D/g,'');commit(typed.length>1?code.slice(0,i)+typed:code.slice(0,i)+typed+code.slice(i+1));};x.onkeydown=e=>{if(e.key==='Backspace'&&!code[i]&&i>0){e.preventDefault();commit(code.slice(0,i-1));}if(e.key==='ArrowLeft')refs[i-1]?.focus();if(e.key==='ArrowRight')refs[i+1]?.focus();};x.onfocus=e=>e.target.select();refs.push(x);root.append(x);}); return {get value(){return code;},set value(v){commit(v);}};
  }

  function initSwitch(button) { if(button.dataset.controlEnhanced)return;button.dataset.controlEnhanced='true';button.classList.add('switch');button.type='button';button.setAttribute('role','switch');if(!button.hasAttribute('aria-checked'))button.setAttribute('aria-checked','false');if(!button.querySelector('.switch-thumb'))button.innerHTML='<span class="switch-thumb"></span>';button.onclick=()=>{if(button.disabled)return;const on=button.getAttribute('aria-checked')!=='true';button.setAttribute('aria-checked',String(on));button.dispatchEvent(new CustomEvent('checkedchange',{bubbles:true,detail:{checked:on}}));}; }

  function scan(root=document) { root.querySelectorAll?.('select:not([data-control-enhanced])').forEach(x=>{if(!x.matches('#noteForm [name="followUpStatus"]'))enhanceSelect(x)}); root.querySelectorAll?.('input[type="number"]:not([data-control-enhanced])').forEach(x=>{if(!x.closest('#createFamilyForm'))enhanceNumber(x)}); root.querySelectorAll?.('[data-switch]:not([data-control-enhanced])').forEach(initSwitch); }
  function syncSearchOptions(){const search=document.querySelector('#searchInput');if(!search)return;const options=[...document.querySelectorAll('#familyList .family-item')].flatMap(x=>{const name=x.querySelector('b')?.textContent?.trim(),meta=x.querySelector('p')?.textContent?.trim();return [name,meta?.split(' · ')[0]].filter(Boolean);});enhanceCombobox(search,options);}
  function init(){scan();syncSearchOptions();const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)scan(n);syncSearchOptions();});observer.observe(document.body,{childList:true,subtree:true});}
  window.ControlSystem={enhanceCombobox,setComboboxOptions:(selector,options)=>enhanceCombobox(document.querySelector(selector),options),enhanceSelect,enhanceNumber,createOtp,initSwitch,fa,en};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
