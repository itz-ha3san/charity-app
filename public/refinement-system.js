/* Family Case — refinement layer: keeps existing workflows, removes friction. */
(() => {
  'use strict';
  const STORAGE_PREFIX = 'family-case:draft:v1:';
  const skipDraft = new Set(['loginForm','bootstrapForm','forcedPasswordForm','advancedFamilyForm','reportFilter','c7FinanceFilter','supportPublicForm']);
  const fileLike = el => el.matches('input[type="file"], input[type="password"]');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formKey = form => `${STORAGE_PREFIX}${location.pathname}:${form.id || 'form'}`;

  function toast(message, type='info') {
    if (window.UXSystem?.toast) return window.UXSystem.toast({title: message, variant: type});
    const root = document.querySelector('#toastRoot');
    if (!root) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    root.append(node);
    setTimeout(() => node.remove(), 2800);
  }

  function formDataSnapshot(form) {
    const data = {};
    [...form.elements].forEach(el => {
      if (!el.name || fileLike(el) || el.disabled) return;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else data[el.name] = el.value;
    });
    return data;
  }

  function restoreDraft(form) {
    if (!form.id || skipDraft.has(form.id) || form.dataset.noAutosave !== undefined || form.dataset.autosave !== 'true') return;
    let raw;
    try { raw = localStorage.getItem(formKey(form)); } catch { return; }
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const fields = [...form.elements].filter(el => el.name && !fileLike(el));
      const usable = fields.some(el => data[el.name] !== undefined && data[el.name] !== '');
      if (!usable) return;
      const bar = document.createElement('div');
      bar.className = 'draft-restore';
      bar.innerHTML = `<span>پیش‌نویس ذخیره‌شده پیدا شد.</span><button type="button" class="secondary">بازیابی</button><button type="button" class="ghost">حذف</button>`;
      form.prepend(bar);
      bar.children[1].onclick = () => {
        fields.forEach(el => {
          if (data[el.name] === undefined) return;
          if (el.type === 'checkbox') el.checked = Boolean(data[el.name]);
          else if (el.type === 'radio') el.checked = el.value === data[el.name];
          else el.value = data[el.name];
          el.dispatchEvent(new Event('input', {bubbles:true}));
          el.dispatchEvent(new Event('change', {bubbles:true}));
        });
        bar.remove();
        toast('پیش‌نویس بازیابی شد.', 'success');
      };
      bar.children[2].onclick = () => { localStorage.removeItem(formKey(form)); bar.remove(); };
    } catch { localStorage.removeItem(formKey(form)); }
  }

  function setupAutosave(form) {
    if (!form || form.dataset.autosaveReady || !form.id || skipDraft.has(form.id) || form.dataset.noAutosave !== undefined || form.dataset.autosave !== 'true') return;
    if (!form.querySelector('input:not([type=file]), textarea, select')) return;
    form.dataset.autosaveReady = '1';
    let timer;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const snapshot = formDataSnapshot(form);
          if (Object.values(snapshot).every(v => v === '' || v === false)) return;
          localStorage.setItem(formKey(form), JSON.stringify(snapshot));
          form.dataset.draftSaved = '1';
          const status = form.querySelector('.draft-status') || (() => {
            const s=document.createElement('small'); s.className='draft-status'; form.append(s); return s;
          })();
          status.textContent = 'پیش‌نویس خودکار ذخیره شد';
        } catch {}
      }, 500);
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', () => {
      clearTimeout(timer);
      try { localStorage.removeItem(formKey(form)); } catch {}
    });
    restoreDraft(form);
  }

  function setupValidation(form) {
    if (!form || form.dataset.inlineValidationReady) return;
    form.dataset.inlineValidationReady = '1';
    const fields = [...form.querySelectorAll('input, textarea, select')];
    const validate = input => {
      if (fileLike(input) || input.type === 'hidden') return true;
      let message = '';
      const raw = String(input.value ?? '').trim();
      if (input.required && !raw) message = 'تکمیل این فیلد الزامی است.';
      const name = String(input.name || '').toLowerCase();
      const digits = raw.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
      if (!message && raw && /nationalid|کدملی/.test(name) && !/^(\d)\1{9}$/.test(digits) && !/^\d{10}$/.test(digits)) message = 'کد ملی باید دقیقاً ۱۰ رقم باشد.';
      if (!message && raw && /phone|mobile|تلفن/.test(name) && !/^09\d{9}$/.test(digits) && !/^\+?98\d{10}$/.test(digits)) message = 'شماره تماس را به شکل ۰۹xxxxxxxxx وارد کنید.';
      if (!message && raw && input.type === 'number' && input.min && Number(raw) < Number(input.min)) message = `مقدار باید حداقل ${input.min} باشد.`;
      if (!message && raw && input.type === 'number' && input.max && Number(raw) > Number(input.max)) message = `مقدار باید حداکثر ${input.max} باشد.`;
      if (!message && input.pattern) { try { if (!(new RegExp(`^(?:${input.pattern})$`)).test(raw)) message = 'قالب واردشده صحیح نیست.'; } catch {} }
      if (!message && input.minLength && raw.length < Number(input.minLength)) message = `حداقل ${input.minLength} نویسه وارد کنید.`;
      input.classList.toggle('field-invalid', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      let hint = input.parentElement?.querySelector(':scope > .inline-error');
      if (message) {
        if (!hint) { hint=document.createElement('small'); hint.className='inline-error'; input.parentElement?.append(hint); }
        hint.textContent = message;
      } else if (hint) hint.remove();
      return !message;
    };
    fields.forEach(input => {
      input.addEventListener('input', () => validate(input));
      input.addEventListener('blur', () => validate(input));
    });
    form.addEventListener('submit', e => {
      const invalid = fields.filter(input => !validate(input));
      if (invalid.length) {
        e.preventDefault();
        invalid[0].focus({preventScroll:false});
        toast(`لطفاً ${invalid.length === 1 ? 'خطای مشخص‌شده را' : 'خطاهای مشخص‌شده را'} اصلاح کنید.`, 'error');
      }
    }, true);
  }

  function enhanceQuickFilters() {
    const toolbar = document.querySelector('.family-toolbar');
    const select = document.querySelector('#statusFilter');
    if (!toolbar || !select || toolbar.dataset.quickFilters) return;
    toolbar.dataset.quickFilters='1';
    const wrap=document.createElement('div');
    wrap.className='quick-filter-row';
    wrap.setAttribute('aria-label','فیلترهای سریع');
    [['active','فعال'],['archived','آرشیوشده'],['all','همه']].forEach(([value,label])=>{
      const b=document.createElement('button');
      b.type='button'; b.className='quick-filter'; b.dataset.value=value; b.textContent=label;
      b.onclick=()=>{ select.value=value; select.dispatchEvent(new Event('change',{bubbles:true})); sync(); };
      wrap.append(b);
    });
    toolbar.after(wrap);
    const sync=()=>wrap.querySelectorAll('.quick-filter').forEach(b=>b.classList.toggle('active',b.dataset.value===select.value));
    select.addEventListener('change',sync); sync();
  }

  function enhanceTables(root=document) {
    root.querySelectorAll?.('table').forEach(table=>{
      table.classList.add('optimized-table');
      const head=table.tHead;
      if (!head || table.dataset.columnControls) return;
      table.dataset.columnControls='1';
      const controls=document.createElement('details');
      controls.className='column-controls';
      controls.innerHTML='<summary>تنظیم ستون‌ها</summary><div></div>';
      const box=controls.lastElementChild;
      [...head.rows[0].cells].forEach((cell,i)=>{
        const label=document.createElement('label');
        label.innerHTML=`<input type="checkbox" checked> ${esc(cell.textContent.trim()||`ستون ${i+1}`)}`;
        label.querySelector('input').onchange=e=>{
          [...table.rows].forEach(row=>{ if(row.cells[i]) row.cells[i].hidden=!e.target.checked; });
        };
        box.append(label);
      });
      table.parentElement?.before(controls);
    });
  }

  function setupSkeleton(root=document) {
    root.querySelectorAll?.('.panel-loading').forEach(el=>{
      if (el.dataset.skeleton) return;
      el.dataset.skeleton='1';
      el.innerHTML='<div class="skeleton-stack" aria-label="در حال بارگذاری"><span></span><span></span><span></span><span></span></div>';
    });
  }

  function setupIconButtons(root=document) {
    root.querySelectorAll?.('button').forEach(b=>{
      const text=b.textContent.trim();
      if (text === '×' || (!text && b.querySelector('svg'))) {
        if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', text === '×' ? 'بستن' : 'عملیات');
        b.setAttribute('title', b.getAttribute('aria-label'));
      }
    });
  }

  function openDrawer(title, html) {
    closeDrawer();
    const root=document.createElement('div');
    root.className='quick-drawer-backdrop';
    root.innerHTML=`<aside class="quick-drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><small>پیش‌نمایش سریع</small><h2>${esc(title)}</h2></div><button type="button" class="drawer-close" aria-label="بستن">×</button></header><div class="quick-drawer-body">${html}</div></aside>`;
    document.body.append(root);
    root.querySelector('.drawer-close').onclick=closeDrawer;
    root.addEventListener('click',e=>{if(e.target===root)closeDrawer();});
    document.addEventListener('keydown',drawerEsc);
    document.body.classList.add('drawer-open');
    return root;
  }
  function drawerEsc(e){if(e.key==='Escape')closeDrawer();}
  function closeDrawer(){document.querySelector('.quick-drawer-backdrop')?.remove();document.removeEventListener('keydown',drawerEsc);document.body.classList.remove('drawer-open');}

  function enhanceFamilyPreview() {
    document.querySelectorAll('.family-item-row').forEach(row=>{
      const item=row.querySelector('.family-item[data-id]');
      const b=row.querySelector('.quick-preview-btn');
      if (!item || !b || b.dataset.ready) return;
      b.dataset.ready='1';
      b.onclick=e=>{
        e.stopPropagation();
        const name=item.querySelector('b')?.textContent || 'پرونده';
        const p=item.querySelector('p')?.textContent || '';
        const priority=item.querySelector('.priority')?.textContent || '';
        openDrawer(name, `<div class="preview-stat"><b>اطلاعات پرونده</b><span>${esc(p)}</span></div><div class="preview-stat"><b>اولویت / وضعیت</b><span>${esc(priority)}</span></div><div class="preview-actions"><button type="button" class="primary">مشاهده پرونده کامل</button></div>`);
        document.querySelector('.quick-drawer .primary').onclick=()=>{closeDrawer();item.click();};
      };
    });
  }

  function init(root=document) {
    enhanceQuickFilters();
    enhanceTables(root);
    setupSkeleton(root);
    setupIconButtons(root);
    root.querySelectorAll?.('form').forEach(f=>{setupAutosave(f);setupValidation(f);});
    enhanceFamilyPreview();
  }

  window.FamilyRefinement={openDrawer,closeDrawer,init};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>init());
  else init();
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{
    if(n.nodeType===1) init(n);
  }))).observe(document.body,{childList:true,subtree:true});
})();
