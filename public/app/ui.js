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
  window.AppUI=Object.freeze({busy,message,toast,mountModal,runPending,requestKey});
})();
