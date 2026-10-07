(()=>{
  function bind(form){
    if(form.dataset.reportLimits)return;form.dataset.reportLimits='1';
    const from=form.elements.namedItem('from'),to=form.elements.namedItem('to');
    const year=form.elements.namedItem('jalaliYear'),month=form.elements.namedItem('jalaliMonth');
    function sync(){
      if(from&&to){const today=ReportRules.today();from.max=to.value&&to.value<today?to.value:today;to.max=today;to.min=from.value||'';
        from.setCustomValidity('');to.setCustomValidity('');
        for(const issue of ReportRules.rangeErrors({from:from.value,to:to.value}))form.elements.namedItem(issue.path)?.setCustomValidity(issue.message);
      }
      if(year&&month){const p=ReportRules.currentPeriod();year.max=String(p.year);month.max=String(Number(year.value)===p.year?p.month:12);
        year.setCustomValidity('');month.setCustomValidity('');
        for(const issue of ReportRules.periodErrors({jalaliYear:year.value,jalaliMonth:month.value}))form.elements.namedItem(issue.path)?.setCustomValidity(issue.message);
        for(const input of [year,month]){const wrap=input.closest('.number-field');if(wrap){const buttons=wrap.querySelectorAll('.number-step');if(buttons[0])buttons[0].disabled=input.value!==''&&Number(input.value)>=Number(input.max);}}
      }
    }
    form.addEventListener('input',sync);form.addEventListener('change',sync);
    form.addEventListener('submit',event=>{sync();if(!form.checkValidity()){event.preventDefault();event.stopImmediatePropagation();const q=Object.fromEntries(new FormData(form)),issues=year?ReportRules.periodErrors(q):ReportRules.rangeErrors(q);if(typeof toast==='function'&&issues.length)toast(issues[0].message);form.reportValidity();}},true);
    sync();
  }
  function scan(){document.querySelectorAll('#reportFilter,#c7FinanceFilter').forEach(bind);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
  new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
})();
