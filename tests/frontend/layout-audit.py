import json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
exec(Path(str(Path(__file__).with_name('browser-test.py'))).read_text().split('with sync_playwright() as p:')[0])
family.update(headName='محمدرضا رضایی نمونه',familySurname='رضایی',address='خیابان نمونه، کوچه آزمایشی، ساختمان پشتیبانی، واحد خانواده تحت پوشش. '*4,headJob='کارگر خدماتی',headEducation={'level':'دیپلم'},members=[dict(id=uid,name='عضو خانواده نمونه',relation='فرزند',nationalId='1000000020',job='محصل',education={})])
base_mock=mock
def layout_mock(route):
 path=route.request.url.split('8000')[-1].split('?')[0]
 if path.endswith('/comprehensive'):d={'completeness':{'percent':75,'missingFields':['insurance']},'followUp':{'lastContactAt':None,'nextFollowUpAt':None},'family':dict(family,housing={'type':'ملکی','deposit':0,'rent':0},insurance={}), 'tags':[],'timeline':[]}
 elif path=='/api/assignees':d={'users':[dict(id=uid,name='مدیر نمونه',position='ceo')]}
 elif path=='/api/funds':d={'funds':[dict(id=uid,name='صندوق حمایت از خانواده‌های نیازمند',description='حمایت از هزینه‌های درمان و معیشت',active=True,budget='10000000000',spent='11110000',remaining='9988890000')]}
 elif path=='/api/users':d={'users':[dict(id=uid,username='long_username_for_layout_validation',displayName='کاربر نمونه با نام طولانی جهت بررسی کادرها',role='caseworker',position='liaison',active=True,activeSessions=2)]}
 elif path=='/api/users/registry':d={'users':[],'passwordCaptureEnabled':False}
 else:return base_mock(route)
 route.fulfill(status=200,content_type='application/json',body=json.dumps(d))
scan_js='''() => {const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[hidden]')};
const cards=[...document.querySelectorAll('.dashboard-card,.family-panel,.info-card,.member-card,.modal,.form-field,.workspace-metric,.user-row,.finance-card,.fund-card,.simple-section-toggle,.family-record-head,.family-toolbar,.form-grid')].filter(visible);
const issues=[];for(const p of cards){const ps=getComputedStyle(p);if(['auto','scroll','hidden','clip'].includes(ps.overflowX))continue;const pr=p.getBoundingClientRect();for(const c of p.children){if(!visible(c)||['absolute','fixed'].includes(getComputedStyle(c).position))continue;const r=c.getBoundingClientRect();if(r.left<pr.left-2||r.right>pr.right+2)issues.push({parent:p.className,child:c.className||c.tagName,px:Math.round(Math.max(pr.left-r.left,r.right-pr.right))})}}
return {documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),cardOverflow:issues.slice(0,15),modalBounds:[...document.querySelectorAll('#modalRoot .modal')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewportHeight:innerHeight}})};}'''
label=sys.argv[1] if len(sys.argv)>1 else 'baseline'
folder=Path('/data/layout-'+label);folder.mkdir(exist_ok=True);results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/local/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1440,1024,768,390,320]:
  for theme in (['light','dark'] if width in [1440,390] else ['light']):
   page=b.new_page(viewport={'width':width,'height':900},color_scheme='light',reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/auth/**',layout_mock);page.route('**/api/**',layout_mock);page.goto('http://127.0.0.1:8000');page.wait_for_timeout(450);page.locator('#themeChoice').select_option(theme)
   actions=[('dashboard',None),('family',"loadDetail('"+fid+"')"),('profile','openMyProfile()'),('donor','openDonorForm()'),('supervisors','openOrganization()'),('users','openUsers()'),('funds','openFunds()'),('financial','openFinancialForm('+json.dumps(family)+')'),('followup','openNoteForm('+json.dumps(family)+')'),('create','openCreateForm()')]
   for name,action in actions:
    page.evaluate("document.querySelector('#modalRoot').innerHTML='';document.body.classList.remove('workspace-nav-open');window.scrollTo(0,0)")
    if action:page.evaluate(action)
    page.wait_for_timeout(260)
    if name=='family':page.evaluate("document.querySelector('#familyDetail').scrollTop=0")
    d=page.evaluate(scan_js);results.append(dict(width=width,theme=theme,state=name,**d))
    if width in [1440,390] and (theme=='light' or name in ['dashboard','create']):
     page.screenshot(path=str(folder/f'{width}-{theme}-{name}.png'),full_page=name in ['dashboard','family'])
     if label=='fixed' and name in ['dashboard','create','profile','family','followup','donor','supervisors','users','funds','financial'] and width in [1440,390] and theme=='light':
      html=page.content();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I)
      def css(m):
       f=Path('/data/project/charity-app-main/public')/m.group(1).lstrip('/');return '<style>'+f.read_text().replace("url('/fonts/", "url('file:///data/project/charity-app-main/public/fonts/")+'</style>'
      html=re.sub(r'<link[^>]+href="([^\"]+\.css)"[^>]*>',css,html);(folder/f'{width}-{theme}-{name}.html').write_text(html)
   page.close()
 b.close()
(folder/'results.json').write_text(json.dumps({'checks':results,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'states':len(results),'documentOverflow':sum(x['documentOverflow']>0 for x in results),'cardOverflowStates':sum(bool(x['cardOverflow']) for x in results),'errors':errors},ensure_ascii=False))
