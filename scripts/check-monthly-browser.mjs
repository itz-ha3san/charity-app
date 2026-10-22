import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
const dir = path.resolve('public');
const styles = [...fs.readFileSync(dir + '/index.html', 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => `<link rel="stylesheet" href="${m[1]}">`).join('');
const fixture = `<html lang="fa" dir="rtl" data-theme="dark"><head>${styles}<style>body{margin:0;font-family:Vazirmatn,Arial}.modal-backdrop{display:flex!important}</style></head><body><div id="modalRoot"></div><div id="toastRoot"></div><script src="/app/assets.js"></script><script src="/app/ui.js"></script><script>window.currentActor={id:'liaison',position:'liaison',role:'caseworker'};window.closeModal=()=>document.querySelector('#modalRoot').replaceChildren();window.posts=[];window.fail=false;const family=(id,name,base,supervisor,aids=[])=>({id,caseNumber:id,familyName:name,baseAmount:base,supervisorId:supervisor,supervisorName:supervisor,aids,conflict:false});const aid={id:'medical',familyId:'a',title:'کمک‌هزینه درمان',category:'پزشکی',amount:'3500000'};const payload={liaisonId:'liaison',liaisonName:'رابط آزمایشی',jalaliYear:1405,jalaliMonth:8,revision:'a'.repeat(64),selectedIds:[],status:'draft',snapshot:{groups:[{supervisorId:'شوندی',supervisorName:'خانم شوندی',families:[family('a','میرزایی','2450000','شوندی',[aid]),family('b','علیزاده','2100000','شوندی')]},{supervisorId:'حیدری',supervisorName:'خانم حیدری',families:[family('c','دولتخواه','4000000','حیدری')]}]}};window.api=async(p,o)=>{if(!p.startsWith('/api/monthly-requests'))throw new Error('INVALID_API_PATH');await new Promise(r=>setTimeout(r,30));if(o){window.posts.push(JSON.parse(o.body));if(window.fail)throw Object.assign(new Error(),{data:{error:'MONTHLY_DATA_CHANGED'}});return {status:JSON.parse(o.body).submit?'submitted':'draft'};}return p.endsWith('liaisons')?{liaisons:[{id:'liaison',name:'رابط آزمایشی'}]}:structuredClone(payload);};</script><script src="/app/monthly.js"></script></body></html>`;
const server = http.createServer((req, res) => { if (req.url === '/fixture') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(fixture);
} const file = path.join(dir, decodeURIComponent(req.url.split('?')[0])); try {
    const data = fs.readFileSync(file);
    res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream');
    res.end(data);
}
catch {
    res.statusCode = 404;
    res.end();
} });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), headless: true, args: ['--no-sandbox'] });
let count = 0;
try {
    for (const theme of ['dark', 'light'])
        for (const width of [1280, 390, 320]) {
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            const errors = [];
            page.on('pageerror', x => errors.push(x.message));
            await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
            await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
            await page.evaluate(() => window.openMonthlyRequests());
            await page.locator('[data-mn-aid]').waitFor();
            assert.equal(await page.locator('.mn-invoice').count(), 2);
            assert.match(await page.locator('[data-mn-grand]').innerText(), /۸٬۵۵۰٬۰۰۰/);
            await page.locator('[data-mn-aid]').check();
            assert.match(await page.locator('[data-mn-grand]').innerText(), /۱۲٬۰۵۰٬۰۰۰/);
            assert.match(await page.locator('.mn-extra-details').innerText(), /میرزایی/);
            assert.match(await page.locator('.mn-extra-details').innerText(), /پزشکی/);
            const familyReceipt=page.locator('[data-mn-receipt-family="a"]');
            assert.match(await familyReceipt.locator('[data-mn-family-total]').innerText(),/۵٬۹۵۰٬۰۰۰/);
            assert.match(await familyReceipt.locator('.mn-family-breakdown').innerText(),/۲٬۴۵۰٬۰۰۰/);
            assert.match(await familyReceipt.locator('.mn-family-breakdown').innerText(),/۳٬۵۰۰٬۰۰۰/);
            assert.match(await familyReceipt.locator('.mn-family-aids').innerText(),/کمک‌هزینه درمان/);
            assert.doesNotMatch(await page.locator('[data-mn-receipt-family="b"]').innerText(),/کمک‌هزینه درمان/);
            await page.locator('[data-mn-aid]').uncheck();
            assert.match(await familyReceipt.locator('[data-mn-family-total]').innerText(),/۲٬۴۵۰٬۰۰۰/);
            assert.doesNotMatch(await familyReceipt.innerText(),/کمک‌هزینه درمان/);
            await page.locator('[data-mn-aid]').check();

            await page.locator('[data-mn-query]').fill('دولتخواه');
            assert.equal(await page.locator('.mn-invoice').count(), 1);
            assert.match(await page.locator('[data-mn-grand]').innerText(), /۱۲٬۰۵۰٬۰۰۰/);
            await page.evaluate(()=>{window.drawnText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.drawnText.push(String(value));return original.call(this,value,...args);};});
            await page.locator('[data-mn-image]').click();
            await page.locator('.mn-export-results a').first().waitFor();
            const drawn=await page.evaluate(()=>window.drawnText.join('\n'));
            assert.match(drawn,/میرزایی/);assert.match(drawn,/علیزاده/);assert.match(drawn,/دولتخواه/);assert.match(drawn,/پزشکی/);assert.match(drawn,/۱۲٬۰۵۰٬۰۰۰/);
            assert.match(drawn,/۵٬۹۵۰٬۰۰۰/);assert.match(drawn,/ماهیانهٔ خانواده/);assert.match(drawn,/موردیِ خانواده/);
            assert.equal((drawn.match(/موضوع: پزشکی · کمک‌هزینه درمان/g)||[]).length,2,'Aid must appear below its own family and again in the lower summary');
            assert.ok(drawn.indexOf('موضوع: پزشکی')>drawn.indexOf('خانوادهٔ میرزایی'));
            assert.ok(drawn.indexOf('موضوع: پزشکی')<drawn.indexOf('خانوادهٔ علیزاده'));

            assert.equal(await page.evaluate(()=>posts.length),0,'Export must not save or submit financial requests');
            const downloadPromise=page.waitForEvent('download');await page.locator('.mn-export-results a').first().click();const download=await downloadPromise;
            assert.match(download.suggestedFilename(),/^monthly-1405-08-all-1\.png$/);
            const png=fs.readFileSync(await download.path());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1320);assert.ok(png.readUInt32BE(20)<=5200);const decoded=pngjs.PNG.sync.read(png);assert.deepEqual([...decoded.data.subarray(0,4)],[12,22,35,255],'Receipt must use the navy ticket background, not a white report sheet');
            if(theme==='dark'&&width===1280&&process.env.MONTHLY_RECEIPT_SAMPLE)fs.writeFileSync(process.env.MONTHLY_RECEIPT_SAMPLE,png);
            await page.evaluate(()=>window.drawnText=[]);
            await page.locator('[data-mn-group-image]').click();
            await page.waitForFunction(()=>document.querySelector('.monthly-modal').getAttribute('aria-busy')==='false');
            const single=await page.evaluate(()=>window.drawnText.join('\n'));assert.match(single,/دولتخواه/);assert.doesNotMatch(single,/میرزایی/);
            await page.locator('[data-mn-query]').fill('');
            await page.locator('[data-mn-save]').click();
            await page.waitForFunction(() => document.querySelector('.mn-message').textContent.includes('ذخیره شد'));
            assert.equal(await page.evaluate(() => posts.length), 1);
            await page.locator('[data-mn-review]').click();
            assert.match(await page.locator('[data-mn-review]').innerText(), /تأیید و ثبت/);
            await page.locator('[data-mn-review]').click();
            await page.waitForFunction(() => document.querySelector('.mn-message').textContent.includes('وجهی منتقل نشده'));
            assert.equal(await page.locator('[data-mn-review]').count(), 0);
            assert.equal(await page.evaluate(() => posts.length), 2);
            const bounds = await page.locator('.monthly-modal').evaluate(n => ({ scroll: n.scrollWidth, client: n.clientWidth }));
            assert.ok(bounds.scroll <= bounds.client + 2, JSON.stringify({ theme, width, bounds }));
            assert.deepEqual(errors, []);
            await page.close();
            count++;
        }
    const long=await browser.newPage();await long.goto(`http://127.0.0.1:${server.address().port}/fixture`);await long.evaluate(()=>AppAssets.load('monthlyImage'));
    const paged=await long.evaluate(async()=>{const families=Array.from({length:85},(_,i)=>({familyName:'خانوادهٔ آزمایشی '+i,baseAmount:'1000000',extras:[],totalAmount:1000000n}));const blobs=await MonthlyInvoiceImage.create({groups:[{supervisorName:'سرپرست آزمایشی',families,totalAmount:85000000n}],liaisonName:'رابط آزمایشی',year:1405,month:8,status:'draft',logoUrl:'/brand/charity-logo-dark.png'});return {pages:blobs.length,png:blobs.every(b=>b.type==='image/png'&&b.size>10000)};});assert.ok(paged.pages>1);assert.ok(paged.png);await long.close();
    // Stale data must not be auto-retried or silently accepted.
    const p = await browser.newPage();
    await p.goto(`http://127.0.0.1:${server.address().port}/fixture`);
    await p.evaluate(() => window.openMonthlyRequests());
    await p.locator('[data-mn-save]').waitFor();
    await p.evaluate(() => window.fail = true);
    await p.locator('[data-mn-save]').click();
    await p.waitForFunction(() => document.querySelector('.mn-message').textContent.includes('تغییر کرده'));
    assert.equal(await p.evaluate(() => posts.length), 1);
    await p.close();
    console.log(`PASS: ${count} responsive/theme cases; totals, family/topic receipt, filtering, draft, review, submit, stale error, real PNG downloads, filtered/full exports, per-family transfers and repeated aid detail, pagination.`);
}
finally {
    await browser.close();
    server.close();
}
