
(() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const modalRoot = () => document.querySelector("#modalRoot");
  const close = () => window.closeModal?.();

  function mount(markup){
    const root = modalRoot();
    if(!root) return null;
    root.innerHTML = markup;
    root.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
    return root;
  }

  window.openRoleDialog = async function(userId, currentRole, username){
    const roles = [
      ["admin","مدیر","دسترسی کامل مدیریتی"],
      ["caseworker","مددکار","مدیریت و پیگیری پرونده‌ها"],
      ["accountant","حسابدار","امور مالی و پرداخت‌ها"],
      ["viewer","مشاهده‌گر","دسترسی فقط برای مشاهده"]
    ];
    return new Promise(resolve => {
      const root = mount(`<div class="modal-backdrop"><div class="modal manage-modal" role="dialog" aria-modal="true" aria-labelledby="roleDialogTitle">
        <div class="modal-head"><div><div class="eyebrow">کنترل دسترسی</div><h2 id="roleDialogTitle">تغییر نقش کاربر</h2><p>سطح دسترسی این حساب را با دقت انتخاب کنید.</p></div><button class="close-btn" data-close aria-label="بستن">×</button></div>
        <div class="manage-modal-body">
          <div class="manage-context"><div class="manage-context-avatar">ک</div><div><b>${esc(username)}</b><span>نقش فعلی: ${esc(roles.find(r=>r[0]===currentRole)?.[1] || currentRole)}</span></div></div>
          <div class="manage-field"><label>نقش جدید</label><div class="manage-role-options">${roles.map(([value,label,help])=>`<div class="manage-role-option"><input type="radio" name="manageRole" id="role-${value}" value="${value}" ${value===currentRole?"checked":""}><label for="role-${value}"><b>${label}</b><span>${help}</span></label></div>`).join("")}</div></div>
          <div class="manage-error" id="manageRoleError"></div>
          <div class="manage-actions"><button type="button" class="secondary" data-close>انصراف</button><button type="button" class="primary" id="saveRole">ذخیره نقش</button></div>
        </div></div></div>`);
      if(!root) return resolve(false);
      root.querySelector("#saveRole").onclick = async () => {
        const role = root.querySelector('input[name="manageRole"]:checked')?.value;
        if(!role) return;
        const button = root.querySelector("#saveRole");
        button.disabled = true; button.classList.add("button-loading");
        try {
          await window.api("/api/users/"+userId,{method:"PATCH",body:JSON.stringify({role})});
          close(); window.toast?.("نقش کاربر با موفقیت تغییر کرد."); window.openUsers?.(); resolve(role);
        } catch(e) {
          root.querySelector("#manageRoleError").textContent = e.message || "تغییر نقش انجام نشد.";
          button.disabled = false; button.classList.remove("button-loading");
        }
      };
      root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click",()=>resolve(false),{once:true}));
    });
  };

  window.openPasswordDialog = async function(userId, username){
    return new Promise(resolve => {
      const root = mount(`<div class="modal-backdrop"><div class="modal manage-modal" role="dialog" aria-modal="true" aria-labelledby="passwordDialogTitle">
        <div class="modal-head"><div><div class="eyebrow">امنیت حساب</div><h2 id="passwordDialogTitle">تغییر رمز عبور</h2><p>یک رمز قوی برای این حساب تعیین کنید.</p></div><button class="close-btn" data-close aria-label="بستن">×</button></div>
        <div class="manage-modal-body">
          <div class="manage-context"><div class="manage-context-avatar">🔒</div><div><b>${esc(username)}</b><span>پس از تغییر رمز، نشست‌های فعال کاربر بسته می‌شوند.</span></div></div>
          <div class="manage-field"><label for="newManagePassword">رمز عبور جدید</label><div class="manage-password-wrap"><input id="newManagePassword" class="manage-input" type="password" minlength="12" autocomplete="new-password" placeholder="حداقل ۱۲ نویسه"><button type="button" class="manage-password-toggle" id="toggleManagePassword" aria-label="نمایش رمز">◉</button></div><div class="manage-strength"><i id="manageStrength"></i></div><span class="manage-help">از ترکیب حرف بزرگ، حرف کوچک و عدد استفاده کنید.</span></div>
          <div class="manage-field"><label for="confirmManagePassword">تکرار رمز عبور</label><input id="confirmManagePassword" class="manage-input" type="password" minlength="12" autocomplete="new-password" placeholder="رمز را دوباره وارد کنید"></div>
          <div class="manage-error" id="managePasswordError"></div>
          <div class="manage-actions"><button type="button" class="secondary" data-close>انصراف</button><button type="button" class="primary" id="savePassword">تغییر رمز عبور</button></div>
        </div></div></div>`);
      if(!root) return resolve(false);
      const pass=root.querySelector("#newManagePassword"), confirm=root.querySelector("#confirmManagePassword"), strength=root.querySelector("#manageStrength");
      pass.addEventListener("input",()=>{let score=0;if(pass.value.length>=12)score++;if(/[A-Z]/.test(pass.value))score++;if(/[a-z]/.test(pass.value))score++;if(/\d/.test(pass.value))score++;strength.style.width=(score*25)+"%"});
      root.querySelector("#toggleManagePassword").onclick=()=>{const visible=pass.type==="text";pass.type=visible?"password":"text";confirm.type=visible?"password":"text"};
      root.querySelector("#savePassword").onclick=async()=>{
        const p=pass.value,c=confirm.value,error=root.querySelector("#managePasswordError");
        if(p.length<12||!/[A-Z]/.test(p)||!/[a-z]/.test(p)||!/\d/.test(p)){error.textContent="رمز عبور باید حداقل ۱۲ نویسه و شامل حرف بزرگ، حرف کوچک و عدد باشد.";return}
        if(p!==c){error.textContent="تکرار رمز عبور با رمز جدید یکسان نیست.";return}
        const button=root.querySelector("#savePassword");button.disabled=true;button.classList.add("button-loading");
        try{await window.api("/api/users/"+userId+"/reset-password",{method:"POST",body:JSON.stringify({password:p})});close();window.toast?.("رمز عبور تغییر کرد و نشست‌های کاربر بسته شد.");resolve(true)}
        catch(e){error.textContent=e.message||"تغییر رمز عبور انجام نشد.";button.disabled=false;button.classList.remove("button-loading")}
      };
      root.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>resolve(false),{once:true}));
      setTimeout(()=>pass.focus(),50);
    });
  };
})();
