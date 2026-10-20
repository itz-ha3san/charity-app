import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
let fixture:any;
test.beforeAll(()=>{fixture=JSON.parse(readFileSync('.tmp/qa-fixtures.json','utf8'));});
async function openEditor(page:Page){await page.goto('/');await page.locator('#loginUsername').fill(fixture.users.admin.username);await page.locator('#loginPassword').fill(fixture.users.admin.password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();await page.evaluate(async(id)=>{const r=await fetch('/api/families/'+id);(window as any).openEditForm((await r.json()).family);},fixture.familyId);await expect(page.locator('[name=headPhone]')).toHaveAttribute('data-persian-kind','mobile');}
test('Persian fields format while typing and serialize canonical data without duplicating IR',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await openEditor(page);
 const f=page.locator('#createFamilyForm'),phone=f.locator('[name=headPhone]'),land=f.locator('[name=familyPhone]'),nid=f.locator('[name=headNationalId]'),card=f.locator('[name=headCardNumber]'),iban=f.locator('[name=headIban]');
 await phone.fill('+۹۸۹۱۲۳۴۵۶۷۸۹');await expect(phone).toHaveValue('۰۹۱۲ ۳۴۵ ۶۷۸۹');await expect(phone).toHaveAttribute('inputmode','tel');
 await land.fill('(021) 1234-5678');await expect(land).toHaveValue('۰۲۱ ۱۲۳۴ ۵۶۷۸');
 await nid.fill('۱۰۰۰۰۰۰۰۱۱');await expect(nid).toHaveValue('۱۰۰-۰۰۰۰۰۱-۱');
 await card.fill('۶۰۳۷۹۹۰۰۰۰۰۰۰۰۰۶');await expect(card).toHaveValue('۶۰۳۷ ۹۹۰۰ ۰۰۰۰ ۰۰۰۶');await expect(card.locator('..').locator('.app-field-valid')).toBeVisible();
 await iban.fill('IR062960000000100324200001');await expect(iban).toHaveValue('0629 6000 0000 1003 2420 0001');await expect(iban.locator('..').locator('.app-iban-prefix')).toHaveText('IR');
 const data=await f.evaluate((form:HTMLFormElement)=>Object.fromEntries(new FormData(form)));
 expect(data.headPhone).toBe('09123456789');expect(data.familyPhone).toBe('02112345678');expect(data.headNationalId).toBe('1000000011');expect(data.headCardNumber).toBe('6037990000000006');expect(data.headIban).toBe('IR062960000000100324200001');
 for(const el of [phone,land,nid,card,iban]){expect(await el.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(true);await expect(el).toHaveAttribute('aria-describedby',/format-hint/);}
 await expect(card.locator('..').locator('..')).toContainText('مالکیت حساب تأیید نشده');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='mobile')expect(await iban.locator('..').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(280);
 await page.screenshot({animations:'disabled',path:`/data/persian-contact-${info.project.name}-light.png`});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({animations:'disabled',path:`/data/persian-contact-${info.project.name}-dark.png`});expect(errors).toEqual([]);
});
test('editing, overflow, required/optional states and dynamically added fields remain usable',async({page})=>{
 await openEditor(page);const f=page.locator('#createFamilyForm'),card=f.locator('[name=headCardNumber]'),phone=f.locator('[name=headPhone]'),iban=f.locator('[name=headIban]');
 await card.fill('6037990000000006');await card.press('Home');for(let i=0;i<4;i++)await card.press('ArrowRight');await card.press('Delete');
 expect(await card.evaluate((i:HTMLInputElement)=>(window as any).PersianRules.digits(i.value))).toBe('603790000000006');
 await card.fill('6037990000000006');await card.press('Home');for(let i=0;i<5;i++)await card.press('ArrowRight');await card.press('Backspace');
 expect(await card.evaluate((i:HTMLInputElement)=>(window as any).PersianRules.digits(i.value))).toBe('603990000000006');
 await card.fill('60379900000000060');await expect(card).toHaveValue('60379900000000060');expect(await card.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(false);
 await card.fill('6037abc9900000006');await card.blur();await expect(card).toHaveValue('6037abc9900000006');await expect(card).toHaveAttribute('aria-invalid','true');await expect(card.locator('..').locator('.app-field-valid')).toBeHidden();
 await phone.fill('02112345678');await phone.blur();await expect(phone).toHaveAttribute('aria-invalid','true');await phone.fill('');expect(await phone.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(false);
 await iban.fill('IR');await iban.blur();await expect(iban).toHaveValue('');expect(await iban.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(true);await expect(iban.locator('..').locator('.app-field-valid')).toBeHidden();
 await page.evaluate(()=>{const f=document.createElement('form');f.id='syntheticRecipients';f.innerHTML='<div class="form-field"><label>تلفن سرپرست</label><input name="phone"></div><div class="form-field"><label>کد ملی سرپرست</label><input name="nationalId"></div>';document.querySelector('#modalRoot .modal')!.append(f);});
 await expect(page.locator('#syntheticRecipients [name=phone]')).toHaveAttribute('data-persian-kind','phone');await expect(page.locator('#syntheticRecipients [name=nationalId]')).toHaveAttribute('data-persian-kind','national');
 const leading=page.locator('#syntheticRecipients [name=nationalId]');await leading.fill('0012345679');await expect(leading).toHaveValue('۰۰۱-۲۳۴۵۶۷-۹');expect(await leading.evaluate((i:HTMLInputElement)=>new FormData(i.form!).get('nationalId'))).toBe('0012345679');
});
test('creation wizard uses the same phone formatter and keeps the review value readable',async({page})=>{
 await openEditor(page);await page.evaluate(()=>(window as any).closeModal());await page.locator('#createBtn').click();
 const f=page.locator('#createFamilyForm'),phone=f.locator('[name=headPhone]');await expect(phone).toHaveAttribute('data-persian-kind','mobile');
 await phone.fill('+989123456789');await expect(phone).toHaveValue('۰۹۱۲ ۳۴۵ ۶۷۸۹');
 await phone.fill('091234567890');await expect(phone).toHaveValue('091234567890');expect(await phone.evaluate((i:HTMLInputElement)=>i.checkValidity())).toBe(false);
 for(const [name,value] of Object.entries({caseNumber:'799',familySurname:'خانواده نمایشی',headName:'سرپرست نمونه',headNationalId:'1000000011',headPhone:'09123456789'}))await f.locator(`[name="${name}"]`).fill(value);
 const steps=await page.locator('[data-go-step]').count();for(let i=1;i<steps;i++)await f.locator('[data-wizard-next]').click();
 await expect(page.locator('.case-review-card').filter({hasText:'شماره تماس'})).toContainText('۰۹۱۲ ۳۴۵ ۶۷۸۹');
});
