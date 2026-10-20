import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
let fixture:any;
test.beforeAll(()=>{fixture=JSON.parse(readFileSync('.tmp/qa-fixtures.json','utf8'))});
async function login(page:Page,role='admin'){
 await page.goto('/');await page.locator('#loginUsername').fill(fixture.users[role].username);await page.locator('#loginPassword').fill(fixture.users[role].password);await page.locator('#loginForm button[type=submit]').click();await expect(page.locator('#logoutBtn')).toBeVisible();
}
test('sidebar and bell open the same all-alerts center, without the start-work card',async({page})=>{
 await login(page,'liaison');await expect(page.locator('.workspace-notices')).toHaveCount(0);
 if(await page.getByRole('button',{name:'بازکردن منوی اصلی',exact:true}).isVisible())await page.getByRole('button',{name:'بازکردن منوی اصلی',exact:true}).click();
 await page.locator('#alertsBtn').click();await expect(page.locator('#alertCenterTitle')).toBeVisible();
 await expect(page.locator('[data-alert-all]')).toHaveAttribute('aria-pressed','true');
 const first=await page.locator('.alert-record-list').textContent();await page.locator('#modalRoot [data-close]').click();
 await page.locator('#notificationInboxBtn').click();await page.locator('[data-notification-all]').click();
 await expect(page.locator('#alertCenterTitle')).toBeVisible();await expect(page.locator('[data-alert-all]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.alert-record-list')).toHaveText(first||'');
 await page.locator('#alertWorkQueuesBtn').click();await expect(page.locator('#shortcutHubTitle')).toHaveText('پیگیری و کارتابل‌ها');await expect(page.locator('[data-hub-index]').filter({hasText:'اقدامات پرونده'})).toBeVisible();
});
test('family completion and highlighted sections stay consistent when opened from any entry',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page);
 const response=await page.request.get(`/api/families/${fixture.familyId}/comprehensive`);expect(response.status()).toBe(200);const c=(await response.json()).completeness;
 expect(c.completeFields+c.missingFields.length).toBe(c.totalFields);expect(c.missingFields.length).toBeGreaterThan(0);expect(c.percent).toBeLessThan(100);
 await page.locator(`.family-item[data-id="${fixture.familyId}"]`).click();
 const detail=page.locator('#familyDetail');await expect(detail.locator('.ui-family-progress')).toHaveAttribute('data-complete','false');
 await expect(detail.locator('.ui-family-progress-percent')).toHaveText(c.percent.toLocaleString('fa-IR')+'٪');
 await expect(detail.locator('.simple-page-guide')).toHaveCount(0);await expect(detail).not.toContainText('کار بعدی چیست');
 const head=detail.locator('.family-record-head');expect((await head.boundingBox())!.height).toBeLessThan(info.project.name==='mobile'?340:210);
 const labels=['اعضای خانوار','گزارش‌های سرپرستی','امور مالی','پرونده‌های تخصصی','اطلاعات تکمیلی پرونده','پیگیری‌ها و گزارش‌ها'];
 for(const label of labels){const toggle=detail.locator('.simple-section-toggle').filter({hasText:label});await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute('aria-expanded','false');}
 await detail.locator('.simple-section-toggle').first().scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:`/data/family-polish-${info.project.name}-collapsed-light.png`});
 await detail.locator('[data-open-completeness]').click();await expect(detail.locator('#comprehensiveSection')).toBeVisible();
 await expect(detail.locator('#profileCompletenessValue')).toHaveText(c.percent.toLocaleString('fa-IR')+'٪');
 await expect(detail.locator('[data-profile-missing-count]')).toHaveText(c.missingFields.length.toLocaleString('fa-IR'));
 await expect(detail.locator('.simple-section-toggle[aria-controls="comprehensiveSection"]')).toHaveAttribute('aria-expanded','true');
 await expect(detail.locator('#comprehensiveSection > .full-profile-hero')).not.toBeVisible();
 await detail.locator('.simple-section-toggle[aria-controls="comprehensiveSection"]').scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:`/data/family-polish-${info.project.name}-expanded-light.png`});
 await detail.locator('.simple-section-toggle[aria-controls="comprehensiveSection"]').click();
 for(const label of labels){const toggle=detail.locator('.simple-section-toggle').filter({hasText:label});await toggle.click();const id=await toggle.getAttribute('aria-controls');await expect(detail.locator(`[id="${id}"]`)).toBeVisible();await toggle.click();await expect(detail.locator(`[id="${id}"]`)).toBeHidden();}
 await detail.locator('[data-family-tab="financeSection"]').click();await expect(detail.locator('#financeSection')).toBeVisible();await expect(detail.locator('.simple-section-toggle[aria-controls="financeSection"] i svg')).toHaveCount(1);
 await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));await detail.evaluate(el=>el.scrollTop=0);await page.waitForTimeout(200);await page.screenshot({path:`/data/family-polish-${info.project.name}-expanded-dark.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('approval review explicitly names the changed field before its old and new values',async({page},info)=>{
 await login(page,'liaison');
 const proposed=await page.request.patch(`/api/families/${fixture.familyId}`,{data:{changedFields:['familyPhone'],proposedData:{familyPhone:info.project.name==='mobile'?'02122223333':'02111112222'}}});expect(proposed.status(),await proposed.text()).toBeLessThan(300);
 await page.locator('#logoutBtn').click();await login(page);
 await page.evaluate(()=>(window as any).openApprovalQueue());await expect(page.locator('#approvalQueueTitle')).toBeVisible();
 const row=page.locator('.approval-diff-row').filter({hasText:'تلفن خانوار'}).first();await expect(row).toBeVisible();await expect(row.locator('.approval-diff-label')).toContainText('فیلد تغییرکرده');await expect(row.locator('.approval-diff-label strong')).toHaveText('تلفن خانوار');
 await page.screenshot({path:`/data/family-polish-${info.project.name}-approval.png`});
});
