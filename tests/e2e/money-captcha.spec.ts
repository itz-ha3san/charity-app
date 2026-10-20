import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
let fixture:any;test.beforeAll(()=>{fixture=JSON.parse(readFileSync('.tmp/qa-fixtures.json','utf8'));});
async function login(page:Page){await page.goto('/');await page.locator('#loginUsername').fill(fixture.users.admin.username);await page.locator('#loginPassword').fill(fixture.users.admin.password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();}
test('money inputs group digits, retain exact toman data and validate invalid values',async({page},info)=>{
 await login(page);await page.evaluate(async(id)=>{const r=await fetch('/api/families/'+id);(window as any).openEditForm((await r.json()).family);},fixture.familyId);
 const input=page.locator('#createFamilyForm [name=housingRent]');await expect(input).toHaveAttribute('data-money','toman');
 await page.locator('[data-edit-jump="edit-section-housing"]').click();await input.fill('۱۲۳۴۵۶۷۸۹۰');await expect(input).toHaveValue('۱٬۲۳۴٬۵۶۷٬۸۹۰');expect(await input.evaluate((i:HTMLInputElement)=>new FormData(i.form!).get(i.name))).toBe('1234567890');
 await input.fill('9007199254740992');expect(await input.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(false);
 for(const value of ['-100','12.5','12abc']){await input.fill(value);await input.blur();expect(await input.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(false);await expect(input).toHaveValue(value);}
 await input.fill('10000000');expect(await input.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(true);await expect(input.locator('..').locator('.app-price-unit')).toHaveText('تومان');
 await page.screenshot({path:`/data/money-fields-${info.project.name}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('money drawer confirms raw amount, cancels and restores focus',async({page},info)=>{
 await login(page);await page.evaluate(()=>{const b=document.createElement('button');b.id='drawerTest';b.textContent='ورود هزینه';b.onclick=async()=>{(window as any).drawerResult=await (window as any).AppUI.promptMoney({title:'بودجه ماهانه',min:'1'});};document.body.append(b);});
 await page.locator('#drawerTest').click();const d=page.locator('.app-money-drawer');await expect(d).toBeVisible();await d.locator('[name=amount]').fill('۱۰۰۰۰۰۰۰');await expect(d.locator('[name=amount]')).toHaveValue('۱۰٬۰۰۰٬۰۰۰');
 await page.screenshot({path:`/data/money-drawer-${info.project.name}-light.png`});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`/data/money-drawer-${info.project.name}-dark.png`});
 await d.locator('button[type=submit]').click();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>(window as any).drawerResult)).toBe('10000000');await expect(page.locator('#drawerTest')).toBeFocused();
 await page.locator('#drawerTest').click();await page.keyboard.press('Escape');await expect(d).toHaveCount(0);expect(await page.evaluate(()=>(window as any).drawerResult)).toBe(null);
});
test('adaptive CAPTCHA uses a server-only, one-use proof and admits valid login',async({page},info)=>{
 await page.goto('/');await expect(page.locator('#loginUsername')).toBeVisible();await page.locator('#loginUsername').fill('unknown_captcha_user');await page.locator('#loginPassword').fill('SyntheticWrong123');
 for(let i=0;i<2;i++){const response=page.waitForResponse(r=>r.url().endsWith('/auth/login'));await page.locator('#loginForm button[type=submit]').click();expect((await response).status()).toBe(401);}
 const root=page.locator('.login-captcha');await expect(root).toBeVisible();await expect(root.locator('input[type=range]')).toBeEnabled();
 const image=await root.locator('.captcha-background').getAttribute('src');const png=PNG.sync.read(Buffer.from(image!.split(',')[1]!,'base64'));let x=-1;for(let i=0;i<png.width;i++){const j=(70*png.width+i)*4;if(png.data[j]===76&&png.data[j+1]===102&&png.data[j+2]===126){x=i-2;break;}}expect(x).toBeGreaterThan(70);
 await root.locator('input').focus();await page.keyboard.press('ArrowRight');await expect(root.locator('input')).toHaveValue('1');
 await root.locator('input').evaluate((i:HTMLInputElement,v)=>{i.value=String(v);i.dispatchEvent(new Event('input',{bubbles:true}));},x);await root.locator('.captcha-verify').click();await expect(root).toHaveClass(/is-verified/);
 await page.screenshot({path:`/data/captcha-${info.project.name}.png`});
 await page.locator('#loginUsername').fill(fixture.users.admin.username);await page.locator('#loginPassword').fill(fixture.users.admin.password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();

});
