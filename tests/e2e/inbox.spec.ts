import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
let fixture:any;
test.beforeAll(()=>{fixture=JSON.parse(readFileSync('.tmp/qa-fixtures.json','utf8'));});
async function login(page:Page,role='admin'){
 await page.goto('/');await page.locator('#loginUsername').fill(fixture.users[role].username);await page.locator('#loginPassword').fill(fixture.users[role].password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();
}
test('real management messages live only in the compact bell; read never means acknowledged',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);
 const title='پیام آزمایشی یکپارچه '+info.project.name;
 const sent=await page.request.post('/api/messages',{data:{title,body:'متن آزمایشی <img src=x onerror=alert(1)> برای بررسی صندوق یکپارچه',recipientIds:[fixture.users.liaison.id],acknowledgementRequired:true}});expect(sent.status()).toBe(201);const {messageId}=await sent.json();
 await page.locator('#logoutBtn').click();await login(page,'liaison');
 expect((await page.request.get('/api/alerts?includeRead=true')).status()).toBe(200);
 await expect(page.locator('[data-workspace-action=messagesBtn]')).toHaveCount(0);
 await page.locator('#notificationInboxBtn').click();await page.locator('[data-notification-tab=messages]').click();
 const panel=page.locator('#notificationInboxPanel');await expect(panel).toContainText(title);
 await panel.locator(`[data-notification-open="message:${messageId}"]`).click();
 await expect(panel.locator('.app-notification-detail')).toContainText('<img src=x');await expect(panel.locator('.app-notification-detail img')).toHaveCount(0);
 let inbox=(await (await page.request.get('/api/messages/inbox?includeRead=true')).json()).messages;
 expect(inbox.find((m:any)=>m.id===messageId).acknowledgedAt).toBeNull();
 await panel.locator('[data-read-all]').click();await expect(panel.locator('[data-read-all]')).toBeDisabled();
 inbox=(await (await page.request.get('/api/messages/inbox?includeRead=true')).json()).messages;
 expect(inbox.find((m:any)=>m.id===messageId).readAt).toBeTruthy();expect(inbox.find((m:any)=>m.id===messageId).acknowledgedAt).toBeNull();
 await panel.locator(`[data-notification-open="message:${messageId}"]`).click();await panel.locator(`[data-message-ack="message:${messageId}"]`).click();
 await expect(panel.locator(`[data-notification-open="message:${messageId}"]`)).toBeVisible();
 inbox=(await (await page.request.get('/api/messages/inbox?includeRead=true')).json()).messages;expect(inbox.find((m:any)=>m.id===messageId).acknowledgedAt).toBeTruthy();
 await panel.locator(`[data-notification-open="message:${messageId}"]`).click();await expect(panel).toContainText('تأیید کرده‌اید');
 const bounds=await panel.boundingBox();expect(bounds!.width).toBeLessThanOrEqual(320);expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);
 await expect(panel.locator('h2')).toHaveCSS('font-size','14px');await page.waitForTimeout(350);await page.screenshot({path:`/data/unified-inbox-${info.project.name}-light.png`});
 await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));await page.waitForTimeout(350);await page.screenshot({path:`/data/unified-inbox-${info.project.name}-dark.png`});
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.locator('#notificationInboxBtn')).toBeFocused();expect(errors).toEqual([]);
});
test('failed alerts do not hide successful messages and retry recovers both sources',async({page},info)=>{
 await login(page);
 const message={id:'00000000-0000-4000-8000-000000000001',title:'پیام مستقل از خطای هشدار',body:'متن ساختگی آزمون تاب‌آوری',senderName:'مدیر آزمایشی',createdAt:new Date().toISOString(),readAt:null,acknowledgementRequired:false};
 await page.route('**/api/messages/inbox?*',r=>r.fulfill({json:{messages:[message],unread:1}}));
 await page.route('**/api/alerts?*',r=>r.fulfill({status:500,json:{error:'SYNTHETIC_FAILURE'}}));
 await page.evaluate(()=>(window as any).refreshAlertBadge());await page.locator('#notificationInboxBtn').click();
 const panel=page.locator('#notificationInboxPanel');await expect(panel).toContainText(message.title);await expect(panel.locator('.app-notifications-error')).toContainText('هشدارها دریافت نشد');await expect(panel).not.toContainText('همه را خوانده‌اید');
 await page.waitForTimeout(350);await page.screenshot({path:`/data/unified-inbox-${info.project.name}-partial-error.png`});
 await page.unroute('**/api/alerts?*');await panel.locator('[data-retry]').click();await expect(panel.locator('.app-notifications-error')).toHaveCount(0);await expect(panel).toContainText(message.title);
 await page.route('**/api/alerts?*',r=>r.fulfill({status:500,json:{error:'SYNTHETIC_FAILURE'}}));await page.unroute('**/api/messages/inbox?*');await page.route('**/api/messages/inbox?*',r=>r.fulfill({status:500,json:{error:'SYNTHETIC_FAILURE'}}));
 await page.evaluate(()=>(window as any).AppNotificationInbox.open());await expect(panel).toContainText('دریافت صندوق کامل نشد');await expect(panel.locator('[data-read-all]')).toBeDisabled();
});
