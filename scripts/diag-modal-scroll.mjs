// Reproduce: open User Management, close it, check whether the page scroll is locked.
const BASE = "http://127.0.0.1:3000", CDP = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "StrongPass123" }) });
const sid = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
const list = await fetch(`${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(list.find((t) => t.type === "page" && t.webSocketDebuggerUrl).webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (m, p = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Network.setCookie", { name: "sid", value: sid.replace(/^sid=/, ""), domain: "127.0.0.1", path: "/" });
await send("Network.clearBrowserCache");
await send("Page.navigate", { url: `${BASE}/` });
await sleep(5000);
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
const state = (label) => ev(`JSON.stringify({
  label: ${JSON.stringify(label)},
  bodyInlineOverflow: document.body.style.overflow || '(none)',
  bodyComputedOverflow: getComputedStyle(document.body).overflow,
  modalRootKids: document.querySelector('#modalRoot').children.length,
  visibleBackdrops: document.querySelectorAll('.modal-backdrop').length,
  uiOverlays: document.querySelectorAll('.ui-overlay').length,
  drawerBackdrops: document.querySelectorAll('.quick-drawer-backdrop').length,
  bodyClass: document.body.className.trim(),
  scrollY: Math.round(window.scrollY),
  canScroll: (() => { const max = document.documentElement.scrollHeight - innerHeight; return max > 0; })()
})`).then((s) => { console.log(s); return JSON.parse(s); });

console.log("--- baseline ---");
await state("before opening");

console.log("\n--- opening مدیریت کاربران ---");
await ev("openUsers()");
await sleep(1200);
await state("users modal open");

const before = await ev("Math.round(window.scrollY)");
await ev("window.scrollBy(0, 400)");
await sleep(400);
console.log(`scroll while modal open: ${before} -> ${await ev("Math.round(window.scrollY)")}`);

console.log("\n--- closing via the × button ---");
await ev("document.querySelector('.modal [data-close], .modal .close-btn')?.click()");
await sleep(1200);
await state("after closing users modal");

const b2 = await ev("Math.round(window.scrollY)");
await ev("window.scrollBy(0, 400)");
await sleep(400);
const a2 = await ev("Math.round(window.scrollY)");
console.log(`scroll after close: ${b2} -> ${a2}   ${b2 === a2 ? "*** LOCKED ***" : "scrolls"}`);

console.log("\n--- also testing a second modal for comparison ---");
await ev("openUsers()"); await sleep(900);
await ev("closeModal()"); await sleep(900);
await state("after openUsers + closeModal()");

console.log("\n--- and Escape ---");
await ev("openUsers()"); await sleep(800);
await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
await sleep(900);
await state("after Escape");
ws.close();
