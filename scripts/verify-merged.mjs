// Temporary: verify merged branch renders the feature and has no dock.
const BASE = "http://127.0.0.1:3000", CDP = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "StrongPass123" }) });
const sid = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
console.log("login:", res.status, !!sid);
let wsUrl;
for (let i = 0; i < 20 && !wsUrl; i++) {
  try { const l = await fetch(`${CDP}/json/list`).then((r) => r.json()); wsUrl = l.find((t) => t.type === "page" && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(500);
}
if (!wsUrl) { console.log("no browser target"); process.exit(0); }
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Network.setCookie", { name: "sid", value: sid.replace(/^sid=/, ""), domain: "127.0.0.1", path: "/" });
await send("Network.clearBrowserCache");
await send("Page.navigate", { url: `${BASE}/` });
await sleep(4500);
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
console.log("dock in DOM:", await ev("!!document.querySelector('.interaction-dock')"));
console.log("dashboard visible:", await ev("!document.querySelector('#dashboard').classList.contains('hidden')"));
await ev("openUsers()"); await sleep(900);
console.log("user rows:", await ev("document.querySelectorAll('.user-row').length"), "delete buttons:", await ev("document.querySelectorAll('[data-delete-user]').length"), "registry btn:", await ev("!!document.querySelector('#registryBtn')"));
await ev("openUserRegistry()"); await sleep(1000);
console.log("registry rows:", await ev("document.querySelectorAll('.registry-table tbody tr').length"), "copy btn:", await ev("!!document.querySelector('#copyPasswords')"));
console.log("errors:", errors.length ? errors : "none");
ws.close();
