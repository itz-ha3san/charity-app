import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
uid='11111111-1111-4111-8111-111111111111'; sid='22222222-2222-4222-8222-222222222222'; fid='33333333-3333-4333-8333-333333333333'
actor=dict(id=uid,name='مدیر آزمون',username='admin',role='admin',position='ceo',mustChangePassword=False,isSuperAdmin=True)
family=dict(id=fid,caseNumber='123',familySurname='آزمون',headName='سرپرست نمونه',headNationalId='1000000011',headBirthDate='',headPhone='09121234567',headCardNumber='',familyPhone='',headEducation={},headJob='',housingType='owned',housingDeposit=0,housingRent=0,address='',notes='',priority='متوسط',members=[],notesHistory=[],archived=False,approvalStatus='approved',profileData={},supervisorId=sid)
supervisors=[dict(id=sid,name='سرپرست حمایتی',nationalId='1000000011',phone='09121234567',notes='اطلاعات سرپرست',active=True,liaisonId=uid,liaisonName='رابط نمونه',familyCount=1)]
requests=[];errors=[];checks=[]
def mock(route):
 req=route.request;url=req.url;requests.append((req.method,url))
 path=url.split('8000')[-1].split('?')[0]
 data={}
 if path=='/auth/status':data={'bootstrapped':True}
 elif path=='/auth/me':data={'user':actor}
 elif path=='/auth/profile' and req.method=='PATCH':
  b=req.post_data_json;actor['name']=b['displayName'];actor['username']=b['username'];data={'updated':True}
 elif path=='/auth/change-password':data={'changed':True,'loginRequired':True}
 elif path=='/api/families' and req.method=='GET':data={'families':[dict(family,memberCount=0,updatedAt='2026-10-07')],'total':1}
 elif path=='/api/families/'+fid:data={'family':family}
 elif path=='/api/organization/overview':data={'supervisors':supervisors,'users':[dict(id=uid,name='رابط نمونه',position='liaison',active=True)],'units':[]}
 elif path=='/api/alerts':data={'alerts':[dict(key='test:'+fid,type='action_due',severity='important',title='هشدار نمونه',message='نیازمند رسیدگی',familyId=fid,read=False)],'unread':1,'counts':{'critical':0,'urgent':0,'important':1,'info':0}}
 elif path=='/api/dashboard':data={'active':1,'overdue':0,'urgent':0}
 elif path=='/api/future/dashboard':data={'donors':{'active':0},'cashDonations':'0','inventory':{'items':0,'low':0},'supportRequests':{'new':0},'notifications':{'queued':0}}
 elif path=='/api/donors':data={'donors':[]} if req.method=='GET' else {'donorId':uid}
 elif path=='/api/donations':data={'donations':[]}
 elif path=='/api/inventory':data={'items':[]}
 elif path=='/api/support-requests':data={'requests':[]}
 elif path=='/api/families/map':data={'families':[]}
 elif path=='/api/users':data={'users':[]}
 else:
  data={'items':[],'documents':[],'notes':[],'assignees':[],'assignment':None,'referrals':[],'reports':[],'plan':None,'actions':[],'cases':[],'financialCases':[],'paidAmount':'0','pendingAmount':'0','profile':{},'completeness':{},'members':[],'events':[]}
 route.fulfill(status=201 if req.method=='POST' and path in ['/api/donors','/api/supervisors','/api/families'] else 200,content_type='application/json',body=json.dumps(data))
def check(name,cond):
 checks.append({'name':name,'passed':bool(cond)});print(name,cond,flush=True)
 if not cond:raise AssertionError(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/local/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000},color_scheme='dark');page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/auth/**',mock);page.route('**/api/**',mock);page.goto('http://127.0.0.1:8000');page.wait_for_timeout(1200)
 check('system dark is initial theme',page.locator('html').get_attribute('data-theme')=='dark')
 page.locator('#themeChoice').select_option('light');check('switch light',page.locator('html').get_attribute('data-theme')=='light');page.reload();page.wait_for_timeout(800);check('theme persists',page.locator('html').get_attribute('data-theme')=='light');page.locator('#themeChoice').select_option('system');page.emulate_media(color_scheme='light');page.wait_for_timeout(200);check('system preference follows OS',page.locator('html').get_attribute('data-theme')=='light')
 check('one status selector only',page.locator('.ui-segment').count()==1 and page.locator('.quick-filter-row').count()==0)
 page.locator('.workspace-metric[data-workspace-action="alertsBtn"]').click();page.wait_for_timeout(300);check('unread metric opens modal',page.get_by_text('هشدارها و پیگیری خودکار',exact=True).is_visible());check('unread API flag sent',any('includeRead=false' in u for m,u in requests));page.locator('#modalRoot [data-close]').click()
 page.locator('#myProfileBtn').click();page.wait_for_timeout(250);page.locator('#myProfileForm [name=displayName]').fill('مدیر جدید');page.locator('#myProfileForm [name=currentPassword]').fill('StrongPass123');page.locator('#myProfileForm button[type=submit]').click();page.wait_for_timeout(300);check('profile submitted and header updated','مدیر جدید' in page.locator('#userName').inner_text())
 page.locator('#futureBtn').evaluate("el=>{const g=el.closest('.workspace-nav-group');if(g?.querySelector('.workspace-nav-items').hidden)g.querySelector('.workspace-nav-group-title').click()}");page.locator('#futureBtn').click();page.wait_for_timeout(200);page.locator('#newDonor').click();page.wait_for_timeout(200);page.locator('#donorForm [name=name]').fill('حامی نمونه');page.locator('#donorForm [name=phone]').fill('09121234567');page.locator('#donorForm button[type=submit]').click();page.wait_for_timeout(300);check('donor create request sent',any(m=='POST' and u.endswith('/api/donors') for m,u in requests));page.locator('#modalRoot [data-close]').click()
 page.locator('#organizationBtn').click();page.wait_for_timeout(300);check('supervisor details visible','اطلاعات سرپرست' in page.locator('#modalRoot').inner_text());page.locator('[data-supervisor-delete]').click();page.wait_for_timeout(200);check('delete defaults to preserve families',page.locator('#deleteSupervisorForm [name=mode]').input_value()=='pending');page.locator('#deleteSupervisorForm [name=mode]').select_option('transfer');check('replacement selector displayed',page.locator('#replacementField').is_visible());page.locator('#modalRoot [data-close]').click()
 page.locator('#createBtn').click();page.wait_for_timeout(500);check('registered supervisor select mounted',page.locator('[name=supervisorId]').count()==1 and not page.locator('[name=supervisorId]').is_disabled());page.locator('[name=caseNumber]').fill('9999');page.locator('[name=caseNumber]').evaluate("el=>{el.value='9999';el.dispatchEvent(new Event('input',{bubbles:true}))}");check('case 9999 rejected',page.locator('[name=caseNumber]').evaluate('el=>!el.checkValidity()'));page.locator('[name=caseNumber]').fill('۱۲۳');check('Persian case digits normalize',page.locator('[name=caseNumber]').input_value()=='123');page.locator('[name=familySurname]').fill('نام ۱۲');check('digits in names rejected',page.locator('[name=familySurname]').evaluate('el=>!el.checkValidity()'));page.locator('[name=familySurname]').fill('خانواده نمونه');check('error clears while typing',page.locator('[name=familySurname]').get_attribute('aria-invalid')=='false');page.locator('[name=headName]').fill('سرپرست خانواده');page.locator('[name=headNationalId]').fill('1000000011');page.locator('[name=headPhone]').fill('09121234567')
 # DOM evaluation for hidden wizard sections tests underlying controls without skipping integration.
 page.locator('[name=housingType]').evaluate("el=>{el.value='owned';el.dispatchEvent(new Event('change',{bubbles:true}))}");check('owned housing hides deposit and rent',page.locator('[name=housingDeposit]').evaluate('el=>el.disabled && el.closest(".form-field").hidden'))
 page.locator('[name=housingType]').evaluate("el=>{el.value='rent';el.dispatchEvent(new Event('change',{bubbles:true}))}");check('rented housing shows cost',page.locator('[name=housingDeposit]').evaluate('el=>!el.disabled && !el.closest(".form-field").hidden'))
 # Add member exercises former observer loop. Evaluate underlying button due to wizard visibility.
 page.locator('#addMemberBtn').evaluate('el=>el.click()');page.wait_for_timeout(700);check('adding member does not lock page',page.locator('[name=memberName]').count()==1);page.locator('[name=memberName]').evaluate("el=>{el.value='عضو نمونه';el.dispatchEvent(new Event('input',{bubbles:true}))}");page.locator('[name=memberNationalId]').evaluate("el=>{el.value='123';el.dispatchEvent(new Event('input',{bubbles:true}))}");page.wait_for_timeout(400);check('member input stays responsive',page.evaluate('2+2')==4)
 page.screenshot(path='/data/create-form.png',full_page=True)
 page.locator('#modalRoot [data-close]').evaluate('el=>el.click()');page.wait_for_timeout(250)
 # Discard confirmation can appear via CaseWizard: resolve automatically if needed.
 page.on('dialog',lambda d:d.accept());page.evaluate("document.querySelector('#modalRoot').innerHTML=''")
 page.locator('.family-item').first.click();page.wait_for_timeout(700)
 for tab,section in [('comprehensiveSection','comprehensiveSection'),('actionSection','actionSection'),('specialistSection','specialistSection'),('financeSection','financeSection')]:
  page.locator('[data-family-tab="'+tab+'"]').click();page.wait_for_timeout(120);check('tab reveals '+section,not page.locator('#'+section).evaluate('el=>el.hidden'))
 # Search combo used to trigger recursive mutation while its panel was open.
 page.locator('#searchInput').fill('آزمون');page.wait_for_timeout(500);check('search does not enter observer loop',page.evaluate('3+3')==6)
 page.locator('#themeChoice').select_option('dark');page.locator('#searchInput').blur();page.wait_for_timeout(250);page.screenshot(path='/data/dashboard-dark.png',full_page=True)
 check('no uncaught JavaScript errors',not errors)
 # normal admin UI gets no Audit link, but profile still available.
 actor['isSuperAdmin']=False;page.reload();page.wait_for_timeout(700);page.locator('.family-item').first.click();page.wait_for_timeout(400);check('ordinary admin has no family audit button',page.locator('#auditBtn').count()==0);check('ordinary admin has profile entry',page.locator('#myProfileBtn').count()==1)
 b.close()
Path('/data/browser-test-result.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False))
