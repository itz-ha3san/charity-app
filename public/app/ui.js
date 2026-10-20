/* Shared form feedback and modal mount. Keep existing design-system classes, not another CSS skin. */
(() => {
  let toastTimer;
  const pending=new WeakSet(), busyForms=new WeakSet();
  function busy(form,on) {
    if(on===busyForms.has(form))return;
    if(on)busyForms.add(form);else busyForms.delete(form);
    form.setAttribute('aria-busy',String(Boolean(on)));
    for(const button of form.querySelectorAll('button[type="submit"],button:not([type])')) {
      if(on){button.dataset.uiWasDisabled=String(button.disabled);button.disabled=true;button.classList.add('button-loading');const label=document.createElement('span');label.className='app-busy-label';label.setAttribute('role','status');label.textContent=' در حال انجام…';button.append(label);}
      else {button.disabled=button.dataset.uiWasDisabled==='true';button.classList.remove('button-loading');button.querySelector('.app-busy-label')?.remove();delete button.dataset.uiWasDisabled;}
    }
  }
  function message(form,text,type='error') {
    const target=form.querySelector('.message');if(!target)return;
    target.className='message '+type;
    const variant=type==='error'?'destructive':type==='success'?'success':type==='warning'?'warning':'info';
    if(window.EnhancedUI&&text)target.innerHTML=EnhancedUI.alertMarkup({variant,text:String(text)});else target.textContent=String(text??'');
    target.setAttribute('role',type==='error'?'alert':'status');
  }
  function toast(text) {
    const root=document.querySelector('#toastRoot');if(!root)return;
    clearTimeout(toastTimer);
    const node=document.createElement('div');node.className='toast';node.setAttribute('role','status');node.textContent=String(text??'');
    root.replaceChildren(node);toastTimer=setTimeout(()=>root.replaceChildren(),3200);
  }
  function mountModal(markup,onClose=()=>window.closeModal?.()) {
    const root=document.querySelector('#modalRoot');if(!root)return null;
    root.innerHTML=markup;
    root.querySelectorAll('[data-close]').forEach(button=>button.onclick=onClose);
    const modal=root.querySelector('.modal');
    if(modal){modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');const title=modal.querySelector('h2,h3');if(title){title.id=title.id||'activeDialogTitle';modal.setAttribute('aria-labelledby',title.id);}}
    return root;
  }
  async function runPending(form,action) {
    if(pending.has(form))return;
    pending.add(form);busy(form,true);
    try{return await action();}finally{pending.delete(form);busy(form,false);}
  }
  function requestKey() {
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    // getRandomValues remains available on private-network HTTP development origins.
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  }
  function promptMoney({title='ورود مبلغ',value='',min='0',required=true,description='مبلغ را به تومان وارد کنید.'}={}){
    return new Promise(resolve=>{
      const esc=EnhancedUI.esc,previous=document.activeElement,d=document.createElement('dialog');d.className='app-money-drawer';
      d.innerHTML=`<form class="app-money-form"><header class="app-drawer-head"><button type="button" class="app-drawer-handle" aria-label="بستن کشو"><span></span></button><div class="app-drawer-heading"><div><span class="eyebrow">مبلغ و تأیید</span><h2 id="moneyDrawerTitle">${esc(title)}</h2><p id="moneyDrawerDescription">${esc(description)}</p></div><button type="button" data-money-cancel aria-label="بستن کشو">×</button></div></header><div class="app-drawer-body"><div class="form-field"><label for="drawerMoneyAmount">مبلغ <span class="muted">(تومان)</span></label><input id="drawerMoneyAmount" name="amount" data-money="toman" min="${esc(min)}" value="${esc(value)}" ${required?'required':''} placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰"></div><p class="app-drawer-note">تأیید این مبلغ به‌تنهایی به معنای انجام پرداخت نیست.</p></div><footer class="app-drawer-footer"><button class="primary" type="submit">تأیید مبلغ</button><button class="secondary" type="button" data-money-cancel>انصراف</button></footer></form>`;
      d.setAttribute('aria-labelledby','moneyDrawerTitle');d.setAttribute('aria-describedby','moneyDrawerDescription');let done=false;
      const finish=value=>{if(done)return;done=true;d.close();d.remove();if(previous?.isConnected)previous.focus();resolve(value);};
      d.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(null);}else if(e.key==='Tab')e.stopPropagation();});
      d.addEventListener('cancel',e=>{e.preventDefault();finish(null);});d.querySelectorAll('[data-money-cancel],.app-drawer-handle').forEach(b=>b.onclick=()=>finish(null));d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish(null);});
      const handle=d.querySelector('.app-drawer-handle');let start=null;handle.addEventListener('pointerdown',e=>{start=e.clientY;handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointerup',e=>{if(start!==null&&e.clientY-start>60&&matchMedia('(max-width:600px)').matches)finish(null);start=null;});handle.addEventListener('pointercancel',()=>start=null);
      document.body.append(d);EnhancedUI.scan();d.showModal();const input=d.querySelector('input');input.focus();input.select();d.querySelector('form').onsubmit=e=>{e.preventDefault();if(!EnhancedUI.validateMoney(input,{show:true})){input.reportValidity();return;}finish(EnhancedUI.moneyRaw(input.value));};
    });
  }
  window.AppUI=Object.freeze({busy,message,toast,mountModal,runPending,requestKey,promptMoney});
})();
