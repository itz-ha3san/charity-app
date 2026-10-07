// Find which admin modal leaves the page scroll locked after closing.
const BASE = "http://127.0.0.1:3000", CDP = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "StrongPass123" }) });
const sid = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
const list = await fetch(`${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(list.find((t) => t.type === "page" && t.webSocketDebuggerUrl).webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (m, p = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Network.setCookie", { name: "sid", value: sid.replace(/^sid=/, ""), domain: "127.0.0.1", path: "/" });
await send("Network.clearBrowserCache");
await send("Page.navigate", { url: `${BASE}/` });
await sleep(5000);
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
const probe = () => ev(`JSON.stringify({overflow: document.body.style.overflow || '(none)', kids: document.querySelector('#modalRoot').children.length, backdrops: document.querySelectorAll('.modal-backdrop').length, overlays: document.querySelectorAll('.ui-overlay').length})`);

const fns = ["openUsers", "openSessions", "openSecurityCenter", "openFunds", "openOrganization", "openUserRegistry", "openTrainingCenter", "openUatCenter"];
for (const fn of fns) {
  const exists = await ev(`typeof ${fn} === 'function'`);
  if (!exists) { console.log(`${fn.padEnd(20)} not defined, skipped`); continue; }
  await ev(`${fn}()`);
  await sleep(1400);
  const during = JSON.parse(await probe());
  // close the way a user would
  await ev(`document.querySelector('#modalRoot [data-close], #modalRoot .close-btn')?.click()`);
  await sleep(1200);
  const after = JSON.parse(await probe());
  const locked = after.overflow === 'hidden';
  console.log(`${fn.padEnd(20)} open={overflow:${during.overflow},kids:${during.kids}}  after close=${JSON.stringify(after)}  ${locked ? "*** LOCKED ***" : "ok"}`);
  // hard reset so one leak does not hide the next
  await ev("document.body.style.overflow=''; document.querySelector('#modalRoot').innerHTML=''; document.querySelectorAll('.ui-overlay,.quick-drawer-backdrop').forEach(x=>x.remove())");
  await sleep(300);
}
console.log("\nconsole errors:", errs.length ? errs.slice(0, 4) : "none");
ws.close();
