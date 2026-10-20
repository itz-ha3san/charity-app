import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
let fixture:any;
test.beforeAll(()=>{fixture=JSON.parse(readFileSync('.tmp/qa-fixtures.json','utf8'));});
async function login(page:Page){await page.goto('/');await page.locator('#loginUsername').fill(fixture.users.admin.username);await page.locator('#loginPassword').fill(fixture.users.admin.password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();}
async function edit(page:Page){await page.evaluate(async(id)=>{const r=await fetch('/api/families/'+id);(window as any).openEditForm((await r.json()).family);},fixture.familyId);await expect(page.locator('.edit-family-modal')).toBeVisible();}
test('structured family inputs normalize without truncation and preserve invalid data for correction',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);await edit(page);
 const form=page.locator('#createFamilyForm'),card=form.locator('[name=headCardNumber]'),iban=form.locator('[name=headIban]');
 await expect(iban).toHaveAttribute('data-persian-kind','iban');
 await card.fill('۶۰۳۷ ۹۹۰۰ ۰۰۰۰ ۰۰۰۶');await card.blur();await expect(card.locator('..')).toHaveClass(/app-input-wrap/);expect(await card.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(true);await expect(form.locator('[name=headCardNumber]').locator('..').locator('..')).toContainText('مالکیت حساب تأیید نشده');
 await card.fill('60379900000000060');await card.blur();expect(await card.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);await expect(card).toHaveValue('60379900000000060');await card.fill('6037990000000006');
 await iban.fill('IR062960000000100324200001');await iban.blur();expect(await iban.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(true);await expect(iban).toHaveValue('0629 6000 0000 1003 2420 0001');
 const nid=form.locator('[name=headNationalId]');await nid.fill('۱۰۰-۰۰۰۰۰۱-۱');await nid.blur();expect(await nid.evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(true);
 await form.locator('[name=province]').fill('تهران');await form.locator('[name=province]').dispatchEvent('change');await form.locator('[name=city]').fill('تهران');await form.locator('[name=city]').dispatchEvent('change');
 await form.locator('[name=postalCode]').fill('۸۱۶۳۸-۴۷۳۵۱');await form.locator('[name=postalCode]').blur();
 await expect(form.locator('[name=postalCode]')).toHaveAttribute('aria-invalid','false');
 await form.locator('[name=city]').fill('شیراز');expect(await form.locator('[name=city]').evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);
 await form.locator('[name=city]').fill('تهران');await form.locator('[name=province]').fill('البرز');await form.locator('[name=province]').dispatchEvent('change');await expect(form.locator('[name=city]')).toHaveValue('');
 await page.screenshot({path:`/data/shared-ui-fields-${info.project.name}.png`,fullPage:true});expect(errors).toEqual([]);
});
test('compact inbox shares unread badge and handles failed writes without hiding errors',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);
 const items=[{key:'synthetic:one',title:'اعلان ساختگی آزمون',severity:'important',createdAt:new Date().toISOString(),read:false},{key:'synthetic:two',title:'اعلان خوانده‌شده آزمون',severity:'info',createdAt:new Date(Date.now()-864e5).toISOString(),read:true}];
 await page.route('**/api/alerts?*',route=>route.fulfill({json:{alerts:items,total:items.length,unread:items.filter(i=>!i.read).length,counts:{critical:0,urgent:0,important:1,info:1}}}));
 await page.evaluate(()=>(window as any).refreshAlertBadge());
 await expect(page.locator('#alertBadge')).toHaveText('۱');await expect(page.locator('#notificationInboxBtn')).toHaveAttribute('aria-label','اعلان‌ها، ۱ خوانده‌نشده');
 await page.locator('#notificationInboxBtn').click();await expect(page.locator('#notificationInboxPanel')).toContainText('اعلان ساختگی آزمون');
 await expect(page.locator('#notificationInboxPanel')).toContainText('امروز');
 await page.locator('[data-notification-tab=unread]').click();await expect(page.locator('#notificationInboxPanel')).not.toContainText('اعلان خوانده‌شده آزمون');
 await page.route('**/api/alerts/synthetic%3Aone/read',route=>route.fulfill({status:500,json:{error:'SYNTHETIC_FAILURE'}}));
 await page.locator('[data-notification-read]').click();await expect(page.locator('.app-notifications-status')).toContainText('ثبت وضعیت انجام نشد');await expect(page.locator('#alertBadge')).toHaveText('۱');
 await page.unroute('**/api/alerts/synthetic%3Aone/read');await page.route('**/api/alerts/synthetic%3Aone/read',route=>{items[0]!.read=true;return route.fulfill({json:{read:true}});});
 await page.locator('[data-read-all]').click();await expect(page.locator('#notificationInboxBtn')).toHaveAttribute('aria-label','اعلان‌ها، ۰ خوانده‌نشده');await expect(page.locator('#alertBadge')).toHaveClass(/hidden/);
 await page.screenshot({path:`/data/shared-ui-inbox-${info.project.name}.png`});
 await page.keyboard.press('Escape');await expect(page.locator('#notificationInboxPanel')).toHaveCount(0);await expect(page.locator('#notificationInboxBtn')).toBeFocused();expect(errors).toEqual([]);
});
test('shared alerts escape text; time input and loading overlay keep native semantics',async({page},info)=>{
 await login(page);
 await page.evaluate(()=>{const form=document.createElement('form');form.id='syntheticComponentForm';form.className='modal';form.innerHTML='<label for="syntheticTime">ساعت تماس آزمایشی</label><input id="syntheticTime" type="time" min="09:30" max="17:00" required><div class="message"></div><button type="submit">ثبت آزمایشی</button>';document.querySelector('#modalRoot')!.innerHTML='<div class="modal-backdrop"></div>';document.querySelector('#modalRoot .modal-backdrop')!.append(form);(window as any).AppUI.message(form,'<img src=x onerror=alert(1)>','warning');});
 await expect(page.locator('#syntheticComponentForm .app-alert-warning')).toContainText('<img');await expect(page.locator('#syntheticComponentForm img')).toHaveCount(0);
 await expect(page.locator('#syntheticTime')).toHaveAttribute('data-enhanced-time','true');await page.locator('#syntheticTime').fill('08:00');expect(await page.locator('#syntheticTime').evaluate((e:HTMLInputElement)=>e.checkValidity())).toBe(false);
 await page.getByRole('button',{name:'انتخاب ساعت فعلی تهران'}).click();const t=await page.locator('#syntheticTime').inputValue();expect(t>='09:30'&&t<='17:00').toBe(true);
 await page.getByRole('button',{name:'پاک‌کردن',exact:true}).click();await expect(page.locator('#syntheticTime')).toHaveValue('');
 await page.evaluate(()=>(window as any).EnhancedUI.loadingOverlay(document.querySelector('#syntheticComponentForm'),true,'در حال آزمون…'));await expect(page.locator('.app-spinner')).toBeVisible();await expect(page.locator('#syntheticComponentForm')).toHaveAttribute('aria-busy','true');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.app-spinner')).toHaveCSS('animation-name','none');await page.evaluate(()=>(window as any).EnhancedUI.loadingOverlay(document.querySelector('#syntheticComponentForm'),false));await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
 await page.screenshot({path:`/data/shared-ui-feedback-${info.project.name}.png`});
});
