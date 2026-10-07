exec(open(str(Path(__file__).with_name('layout-audit.py'))).read().split("label=sys.argv")[0])
from playwright.sync_api import sync_playwright
checks=[];errs=[]
overlap='''()=>{const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.opacity!=='0'&&!e.closest('[hidden]')};const issues=[];document.querySelectorAll('.form-grid,.detail-grid,.workspace-metrics,.family-toolbar,.modal-head,.user-row,.family-record-head,.family-detail-tabs').forEach(p=>{const a=[...p.children].filter(visible).filter(e=>!['absolute','fixed'].includes(getComputedStyle(e).position));for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const x=a[i].getBoundingClientRect(),y=a[j].getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)issues.push(p.className+':'+a[i].tagName+'/'+a[j].tagName)}});return issues}'''
def check(page,state,width):
 data=page.evaluate(scan_js);data['overlaps']=page.evaluate(overlap);checks.append(dict(state=state,width=width,**data));assert data['documentOverflow']==0 and not data['cardOverflow'] and not data['overlaps'],checks[-1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/local/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1440,1024,768,390,320]:
  page=b.new_page(viewport={'width':width,'height':780},reduced_motion='reduce',color_scheme='dark');page.on('pageerror',lambda e:errs.append(str(e)));page.route('**/auth/**',layout_mock);page.route('**/api/**',layout_mock);page.goto('http://127.0.0.1:8000');page.wait_for_timeout(500)
  for theme in ['light','dark']:
   page.locator('#themeChoice').select_option(theme);check(page,'dashboard-'+theme,width)
   page.evaluate("actor=null;showAuth(true);document.querySelector('#modalRoot').innerHTML=''");page.wait_for_timeout(150);check(page,'login-'+theme,width)
   if width in [1440,390]:page.screenshot(path='/data/layout-fixed/'+str(width)+'-'+theme+'-login.png',full_page=True)
   page.evaluate('showDashboard('+json.dumps(actor)+')');page.wait_for_timeout(200)
   if width<=980:
    page.locator('.workspace-menu-toggle').click();page.wait_for_timeout(100);check(page,'navigation-'+theme,width)
    close=page.locator('.workspace-sidebar-close');r=close.bounding_box();assert r['x']>=0 and r['x']+r['width']<=width
    close.click()
  page.evaluate('openFinancialForm('+json.dumps(family)+')');page.wait_for_timeout(250);check(page,'financial-widths',width);assert page.locator('[name=amount]').evaluate("e=>Math.abs(e.closest('.number-field').getBoundingClientRect().width-e.closest('.form-field').getBoundingClientRect().width)<2")
  if width in [1440,390]:page.screenshot(path='/data/layout-fixed/'+str(width)+'-light-financial-final.png')
  page.evaluate("document.querySelector('#modalRoot').innerHTML='';ControlSystem.setComboboxOptions('#searchInput',Array.from({length:40},(_,i)=>'سرپرست نمونه برای بررسی موقعیت فهرست '+i))")
  page.locator('#searchInput').focus();page.wait_for_timeout(200);r=page.locator('.combobox-panel:not([hidden])').bounding_box();assert r['x']>=0 and r['x']+r['width']<=width+1 and r['y']>=0 and r['y']+r['height']<=781
  page.locator('#searchInput').blur()
  # Actual shared date control positioned close to the viewport bottom.
  page.evaluate("profileModal('بررسی تقویم','<div style=\"height:350px\"></div><div class=\"form-field\"><label>تاریخ</label><input type=\"date\" name=\"date\"></div>')")
  page.wait_for_timeout(200);page.locator('.ui-date-trigger').click();page.wait_for_timeout(200);r=page.locator('.ui-calendar').bounding_box();assert r['x']>=0 and r['x']+r['width']<=width+1 and r['y']>=0 and r['y']+r['height']<=781
  page.close()
 b.close()
Path('/data/layout-fixed/extra-results.json').write_text(json.dumps({'checks':checks,'errors':errs},ensure_ascii=False,indent=2));print(json.dumps({'layoutChecks':len(checks),'popupChecks':10,'errors':errs},ensure_ascii=False))
