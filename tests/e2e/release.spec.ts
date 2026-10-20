import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
type Fixture={users:Record<string,{username:string;password:string}>,familyId:string,fundId:string};
let fixture:Fixture;
test.beforeAll(()=>{fixture=JSON.parse(readFileSync(process.env.QA_FIXTURE_PATH||'.tmp/qa-fixtures.json','utf8'))});
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message))});
test.afterEach(({page})=>{expect(errors.get(page)||[],'uncaught browser errors').toEqual([])});
async function login(page:Page,role:string){
 const user=fixture.users[role]!;await page.goto('/');await expect(page.locator('#loginUsername')).toBeVisible();
 await page.locator('#loginUsername').fill(user.username);await page.locator('#loginPassword').fill(user.password);
 const response=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');
 await page.locator('#loginForm button[type="submit"]').click();expect((await response).status()).toBe(200);
 await expect(page.locator('#logoutBtn')).toBeVisible();
}
async function openFamily(page:Page){
 const item=page.locator(`.family-item[data-id="${fixture.familyId}"]`);await expect(item).toBeVisible();await item.click();
 await expect(page.locator('[data-family-tab="financeSection"]')).toBeVisible();
}
test('sign in, create a family through the visible wizard, then read it back',async({page},info)=>{
 await login(page,'admin');await page.locator('#createBtn').click();
 const form=page.locator('#createFamilyForm'),n=info.project.name==='mobile'?632:631;
 const prefix=String(600000000+n),sum=[...prefix].reduce((a,d,i)=>a+Number(d)*(10-i),0)%11;
 for(const [name,value] of Object.entries({caseNumber:String(n),familySurname:'خانواده کیفیت',headName:'سرپرست آزمایشی',headNationalId:prefix+(sum<2?sum:11-sum),headPhone:'09120000000'}))await form.locator(`[name="${name}"]`).fill(value);
 const steps=await page.locator("[data-go-step]").count();
 for(let step=1;step<steps;step++){
   await form.locator('[data-wizard-next]').click();
   await expect(page.locator(`[data-go-step="${step}"]`)).toHaveAttribute('aria-current','step');
 }
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/families'&&r.request().method()==='POST');
 await form.locator('#submitFamily').click();const response=await saved;expect(response.status(),await response.text()).toBe(201);
 const id=(await response.json()).familyId;
 const detail=await page.request.get(`/api/families/${id}`);expect(detail.status()).toBe(200);expect((await detail.json()).family.caseNumber).toBe(String(n));
 await expect(page.locator('#createError')).not.toBeVisible();
});
test('assigned liaison records a follow-up through the real UI',async({page},info)=>{
 await login(page,'liaison');await openFamily(page);
 await page.locator('.simple-section-toggle').filter({hasText:'پیگیری‌ها و گزارش‌ها'}).click();await page.locator('#newNoteBtn').click();
 const text='پیگیری ساختگی کیفیت '+info.project.name;
 await page.locator('#noteForm [name="text"]').fill(text);
 const saved=page.waitForResponse(r=>r.url().endsWith(`/api/families/${fixture.familyId}/notes`)&&r.request().method()==='POST');
 await page.locator('#followupSubmit').click();expect((await saved).status()).toBe(201);
 await expect(page.locator('#noteForm')).toHaveCount(0);
 const detail=await page.request.get(`/api/families/${fixture.familyId}`);
 expect((await detail.json()).family.notesHistory.some((n:{text?:string;body?:string})=>n.text===text||n.body===text)).toBe(true);
});
test('review and approval in UI, then a separate finance user pays exactly once',async({page},info)=>{
 await login(page,'admin');
 // API creates this test's input only; all review, approval, referral and payment actions below use visible UI.
 const setup=await page.request.post(`/api/families/${fixture.familyId}/financial-cases`,{data:{title:'آزمون پرداخت '+info.project.name,category:'سایر',amount:100,jalaliYear:1405,jalaliMonth:7}});
 expect(setup.status()).toBe(201);const id=(await setup.json()).financialCaseId;
 await page.reload();await openFamily(page);await page.locator('[data-family-tab="financeSection"]').click();
 page.on('dialog',dialog=>dialog.accept(dialog.message().includes('مبلغ')?'100':'تأیید آزمایشی'));
 for(const action of ['review','approve','queue_payment']){
  const transition=page.waitForResponse(r=>r.url().endsWith(`/api/financial-cases/${id}/transition`));
  await page.locator(`[data-id="${id}"][data-action="${action}"]`).click();expect((await transition).status()).toBe(200);
 }
 await page.locator('#logoutBtn').click();await login(page,'finance_officer');await openFamily(page);
 await page.locator('[data-family-tab="financeSection"]').click();await page.locator(`[data-pay="${id}"]`).click();
 await page.locator('#paymentForm [name="fundId"]').selectOption(fixture.fundId);
 await page.locator('#paymentForm [name="referenceNo"]').fill('QA-'+info.project.name);
 const paid=page.waitForResponse(r=>r.url().endsWith(`/api/financial-cases/${id}/pay`));
 await page.locator('#paymentForm button.primary').click();const response=await paid;expect(response.status(),await response.text()).toBe(201);
 await expect(page.locator('#paymentForm')).toHaveCount(0);
 await expect(page.locator(`[data-pay="${id}"]`)).toHaveCount(0);
 const result=await page.request.get(`/api/families/${fixture.familyId}/financial-cases`);
 const row=(await result.json()).financialCases.find((x:{id:string})=>x.id===id);
 expect(row.status).toBe('پرداخت شده');expect(row.paidAmount).toBe('100');
});
test('all synthetic roles log in and retain their clinical and family scope',async({page})=>{
 for(const role of Object.keys(fixture.users)){
  await login(page,role);
  const clinical=await page.request.get(`/api/families/${fixture.familyId}/specialist-cases`);
  if(role==='other_liaison'){expect(clinical.status(),role).toBe(403)}else{
   expect(clinical.status(),role).toBe(200);const body=await clinical.json();
   if(['admin','ceo'].includes(role))expect(body.cases.length,role).toBe(2);
   else if(role.startsWith('health_')||role.startsWith('education_')){
    expect(body.cases.length,role).toBe(1);expect(body.cases[0].domain,role).toBe(role.startsWith('health_')?'health':'education');
   }else{expect(body.restricted,role).toBe(true);expect(body.cases,role).toEqual([])}
  }
  if(role==='viewer'){
   const denied=await page.request.post(`/api/families/${fixture.familyId}/notes`,{data:{text:'نباید ذخیره شود'}});expect(denied.status()).toBe(403);
  }
  await page.locator('#logoutBtn').click();await expect(page.locator('#loginUsername')).toBeVisible();
 }
});

test('management and approval features load only on demand and remain usable',async({page})=>{
 await login(page,'admin');
 await expect(page.locator('script[src="/app/admin.js"]')).toHaveCount(0);
 await expect(page.locator('script[src="/approval-review.js"]')).toHaveCount(0);
 await page.evaluate(()=>{(window as any).openManagementHub()});
 await page.locator('#modalRoot [data-hub-index]').filter({hasText:'مدیریت کاربران'}).click();
 await expect(page.locator('#createUserBtn')).toBeVisible();
 await expect(page.locator('script[src="/app/admin.js"]')).toHaveCount(1);
 await page.locator('#modalRoot [data-close]').first().click();
 await page.evaluate(()=>{(window as any).openWorkQueuesHub()});
 await page.locator('#modalRoot [data-hub-index]').filter({hasText:'تأییدهای در انتظار'}).click();
 await expect(page.locator('#approvalQueueTitle')).toBeVisible();
 await expect(page.locator('script[src="/approval-review.js"]')).toHaveCount(1);
 await page.locator('#modalRoot [data-close]').first().click();
 await expect(page.locator('#modalRoot .modal')).toHaveCount(0);
});
test('a lost successful payment response can be retried with the same idempotency key',async({page},info)=>{
 await login(page,'admin');
 const created=await page.request.post(`/api/families/${fixture.familyId}/financial-cases`,{data:{title:'آزمون بازیابی پاسخ '+info.project.name,category:'سایر',amount:50,jalaliYear:1405,jalaliMonth:7}});expect(created.status()).toBe(201);
 const id=(await created.json()).financialCaseId;
 for(const action of ['review','approve','queue_payment'])expect((await page.request.post(`/api/financial-cases/${id}/transition`,{data:{action}})).status()).toBe(200);
 await page.reload();await openFamily(page);await page.locator('[data-family-tab="financeSection"]').click();await page.locator(`[data-pay="${id}"]`).click();
 await page.locator('#paymentForm [name="fundId"]').selectOption(fixture.fundId);
 await page.locator('#paymentForm [name="referenceNo"]').fill('QA-LOST-'+info.project.name);
 const keys:string[]=[];let first=true;
 await page.route(`**/api/financial-cases/${id}/pay`,async route=>{
  keys.push(route.request().headers()['idempotency-key']||'');
  const actual=await route.fetch();expect(actual.status()).toBe(201);
  if(first){first=false;await route.abort('failed')}else{await route.fulfill({response:actual})}
 });
 await page.locator('#paymentForm button.primary').click();
 await expect(page.locator('#paymentError')).not.toBeEmpty();
 await expect(page.locator('#paymentForm button.primary')).toBeEnabled();
 const replay=page.waitForResponse(r=>r.url().endsWith(`/api/financial-cases/${id}/pay`));
 await page.locator('#paymentForm button.primary').click();expect((await replay).headers()['idempotency-replayed']).toBe('true');
 await expect(page.locator('#paymentForm')).toHaveCount(0);
 expect(keys.length).toBe(2);expect(keys[0]).toBeTruthy();expect(keys[1]).toBe(keys[0]);
 const result=await page.request.get(`/api/families/${fixture.familyId}/financial-cases`),data=await result.json();
 expect(data.history.filter((e:any)=>e.financialCaseId===id&&e.action==='pay')).toHaveLength(1);
});
test.describe('modular shell offline safety',()=>{
 test.use({serviceWorkers:'allow'});
 test('service worker caches new shell assets but no private API responses',async({page,context})=>{
  await login(page,'admin');
  // Development loopback intentionally unregisters workers; install explicitly for this focused worker test.
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));await fetch('/api/families',{credentials:'include'})});
  const paths=await page.evaluate(async()=>{const keys=await caches.keys();const key=keys.find(k=>k.startsWith('family-case-shell-v102-'));if(!key)return [];const cache=await caches.open(key);return (await cache.keys()).map(r=>new URL(r.url).pathname)});
  expect(paths).toContain('/app/bootstrap.js');expect(paths).toContain('/app/base.css');expect(paths).toContain('/auth-v3.css');expect(paths).toContain('/app/financial-intelligence.css');
  expect(paths.some(p=>/^\/(api|auth)\//.test(p))).toBe(false);
  await context.setOffline(true);await page.goto('/');
  await expect(page.getByRole('heading',{name:'اتصال در دسترس نیست'})).toBeVisible();
  await context.setOffline(false);
 });
});
