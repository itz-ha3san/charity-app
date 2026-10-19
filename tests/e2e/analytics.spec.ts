import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {jalaliPeriod,shiftPeriod} from '../../src/domain/financialAnalytics.js';
let fixture:any;
test.beforeAll(async()=>{
 fixture=JSON.parse(readFileSync(process.env.QA_FIXTURE_PATH||'.tmp/qa-fixtures.json','utf8'));
 const url=process.env.TEST_DATABASE_URL;if(!url||!new URL(url).pathname.includes('test'))throw Error('Synthetic test database required');
 const pool=new pg.Pool({connectionString:url});
 try{
 const owner=(await pool.query("SELECT id FROM users WHERE username='qa_admin'")).rows[0].id;
 for(let i=6;i>0;i--){
  const p=shiftPeriod(jalaliPeriod(),-i), title=`analytics browser synthetic ${p.year}/${p.month}`;
  if((await pool.query('SELECT 1 FROM financial_cases WHERE title=$1',[title])).rowCount)continue;
  const amount=1000000+i*500000;
  const id=(await pool.query("INSERT INTO financial_cases(family_id,title,category,amount,status,created_by)VALUES($1,$2,'معیشت',$3,'پرداخت شده',$4)RETURNING id",[fixture.familyId,title,amount,owner])).rows[0].id;
  await pool.query("INSERT INTO financial_payments(financial_case_id,fund_id,amount,jalali_year,jalali_month,paid_at,reference_no,created_by)VALUES($1,$2,$3,$4,$5,current_date,'analytics browser synthetic',$6)",[id,fixture.fundId,amount,p.year,p.month,owner]);
 }
 }finally{await pool.end();}
});
async function login(page:Page,role='admin'){
 await page.goto('/');await page.locator('#loginUsername').fill(fixture.users[role].username);await page.locator('#loginPassword').fill(fixture.users[role].password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();
}
test('login branding, password reveal, mobile layout and dark mode',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#authTitle')).toHaveText('دوباره، کنار هم');
 await expect(page.locator('#auth .auth-charity-brand img')).toBeVisible();
 await page.locator('#loginPassword').fill('SyntheticNotAUserSecret');await page.locator('#toggleLoginPassword').click();await expect(page.locator('#loginPassword')).toHaveAttribute('type','text');await page.locator('#toggleLoginPassword').click();await expect(page.locator('#loginPassword')).toHaveAttribute('type','password');await page.locator('#loginPassword').fill('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`/data/charity-login-${info.project.name}.png`,fullPage:true});
 await page.evaluate(()=>{localStorage.setItem('charity-theme','dark');});await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.screenshot({path:`/data/charity-login-${info.project.name}-dark.png`,fullPage:true});expect(errors).toEqual([]);
});
test('finance analytics visible UI, chart toggle, scenario and family drilldown',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page,'finance_deputy');
 // Open the actual navigation item; mobile drawer is intentionally collapsed.
 const nav=page.locator('#financeHubBtn');
 const menu=page.locator('.workspace-menu-toggle');if(await menu.isVisible())await menu.click();
 await nav.click();await page.getByText('داشبورد مالی هوشمند',{exact:true}).click();
 await expect(page.locator('.fi-modal')).toBeVisible();await expect(page.locator('#fiContent')).toHaveAttribute('aria-busy','false');await expect(page.locator('.fi-bar').first()).toBeVisible();
 expect((await page.request.get('/api/financial-analytics')).status()).toBe(200);
 await page.locator('[data-fi-metric=payments]').click();await expect(page.locator('[data-fi-metric=payments]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-fi-metric=amount]').click();
 const originalSize=page.viewportSize()!;await page.setViewportSize({...originalSize,width:originalSize.width-20});await expect.poll(async()=>page.locator('#fiChart svg').evaluate((e)=>Math.abs(Number(e.getAttribute('width'))-e.parentElement!.clientWidth))).toBeLessThan(2);await page.setViewportSize(originalSize);
 await page.locator('#fiScenario').fill('20');await expect(page.locator('#fiScenarioResult')).toContainText('سناریوی فرضی');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`/data/charity-finance-${info.project.name}.png`,fullPage:true});
 await page.locator('#fiFilters [name=familySearch]').fill('۶۱۰');await page.locator('#fiFamilySearch').click();await expect(page.locator('#fiSearchStatus')).toContainText('نتیجه');await page.locator('#fiFilters [name=familyId]').selectOption(fixture.familyId);await page.locator('#fiFilters button[type=submit]').click();await expect(page.locator('.fi-panel h3').first()).toHaveText('دریافتی خانواده انتخاب‌شده');
 await page.locator('.fi-modal [data-close]').click();await expect(page.locator('.fi-modal')).toHaveCount(0);expect(errors).toEqual([]);
});
test('non-financial liaison cannot load analytics or family picker',async({page})=>{
 await login(page,'liaison');expect((await page.request.get('/api/financial-analytics')).status()).toBe(403);expect((await page.request.get('/api/financial-analytics/families')).status()).toBe(403);
});
