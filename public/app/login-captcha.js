/* Adaptive first-party puzzle. The proof is checked and consumed by the server. */
(function(){
 let active=false,verified=false,root,range,status,verify,refresh,background,piece,timer,generation=0,loading=false;
 function say(text){status.textContent=text;}
 function mount(){
  if(root)return;root=document.createElement('section');root.className='login-captcha';root.setAttribute('aria-label','بررسی امنیتی ورود');
  root.innerHTML='<div class="login-captcha-head"><b>بررسی امنیتی</b><button type="button" class="secondary captcha-refresh" aria-label="تصویر جدید"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.2 6.2a8 8 0 0 1 13 2M4.8 15.8a8 8 0 0 0 13 2"/></svg></button></div><p id="captchaHelp">قطعه را با نوار زیر روی جای خالی تصویر قرار دهید.</p><div class="captcha-stage" dir="ltr"><img class="captcha-background" alt="تصویر پازل با نشان خیریه"><img class="captcha-piece" alt="" aria-hidden="true"></div><label for="captchaPosition" class="captcha-sr-only">جابه‌جایی قطعه پازل</label><input id="captchaPosition" data-ui-slider="1" type="range" min="0" max="280" step="1" value="0" dir="ltr" aria-describedby="captchaHelp captchaStatus"><div class="captcha-bottom"><span id="captchaStatus" role="status" aria-live="polite"></span><button class="secondary captcha-verify" type="button">بررسی قطعه</button></div>';
  const form=document.querySelector('#loginForm');form.insertBefore(root,form.querySelector('.auth-submit')||form.querySelector('button[type=submit]'));
  range=root.querySelector('input');status=root.querySelector('[role=status]');verify=root.querySelector('.captcha-verify');refresh=root.querySelector('.captcha-refresh');background=root.querySelector('.captcha-background');piece=root.querySelector('.captcha-piece');
  range.addEventListener('input',()=>{piece.style.left=(Number(range.value)/320*100)+'%';});refresh.addEventListener('click',load);verify.addEventListener('click',check);
 }
 async function load(){
  mount();active=true;verified=false;clearTimeout(timer);const version=++generation;loading=true;root.classList.remove('is-verified');range.disabled=true;verify.disabled=true;refresh.disabled=true;say('در حال دریافت تصویر…');
  try{const image=await api('/auth/captcha');if(version!==generation)return;background.src=image.background;piece.src=image.piece;range.value='0';piece.style.left='0%';range.disabled=false;verify.disabled=false;say('با کشیدن نوار یا کلیدهای جهت‌نما قطعه را حرکت دهید.');timer=setTimeout(()=>expire(),image.expiresIn*1000);}
  catch(e){if(version===generation)say(e.message+' از «تصویر جدید» دوباره تلاش کنید.');}
  finally{if(version===generation){loading=false;refresh.disabled=false;}}
 }
 function expire(){verified=false;range.disabled=true;verify.disabled=true;root.classList.remove('is-verified');say('مهلت تصویر تمام شد؛ تصویر جدید بگیرید.');}
 async function check(){
  if(loading||verified)return;const version=generation;verify.disabled=true;range.disabled=true;refresh.disabled=true;
  try{await api('/auth/captcha/verify',{method:'POST',body:JSON.stringify({position:Number(range.value)})});if(version!==generation)return;verified=true;root.classList.add('is-verified');say('تأیید شد؛ اکنون وارد شوید.');clearTimeout(timer);timer=setTimeout(expire,60000);}
  catch(e){if(version!==generation)return;verified=false;say(e.message);range.disabled=false;verify.disabled=false;}finally{if(version===generation)refresh.disabled=false;}
 }
 window.LoginCaptcha={require:load,canSubmit(){if(!active||verified)return true;say('ابتدا قطعه پازل را بررسی کنید.');range.focus();return false;},reset(){generation++;active=false;verified=false;clearTimeout(timer);root?.remove();root=null;}};
})();
