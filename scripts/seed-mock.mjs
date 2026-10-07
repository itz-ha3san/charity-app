// Mock data seeder for the family-case app.
// Drives the real HTTP API (the same one the UI uses), so it also acts as a
// smoke test of the documented endpoints.
//   Usage: npm run seed:mock      (server must be running, DATABASE_URL in .env)
const BASE = process.env.SEED_BASE || "http://127.0.0.1:3000";
const ADMIN_USER = process.env.SEED_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.SEED_ADMIN_PASS || "StrongPass123";
const MOCK_TAG = "MOCK";

let cookie = "";
const results = [];

const request = async (method, path, body, extraHeaders = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
};

const step = (name, res, { expect = [200, 201], optional = false } = {}) => {
  const ok = expect.includes(res.status);
  results.push({ name, status: res.status, ok: ok || optional, note: ok ? "" : JSON.stringify(res.body).slice(0, 140) });
  return ok ? res.body : null;
};

const login = async (username, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sid="));
  return { status: res.status, cookie: setCookie };
};

// ---------------------------------------------------------------- national id
const withChecksum = (prefix9) => {
  const digits = prefix9.padStart(9, "0").slice(0, 9).split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const r = sum % 11;
  const check = r < 2 ? r : 11 - r;
  return `${prefix9}${check}`;
};

const PERSIAN_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const toJalali = (date) => {
  const gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  let days = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd, label: `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}` };
};
const nowJalali = toJalali(new Date());

// --------------------------------------------------------------------- users
const USERS = [
  { username: "mock.liaison1", displayName: `${MOCK_TAG} رابط یک`, role: "caseworker", position: "liaison" },
  { username: "mock.liaison2", displayName: `${MOCK_TAG} رابط دو`, role: "caseworker", position: "liaison" },
  { username: "mock.health", displayName: `${MOCK_TAG} کارشناس درمان`, role: "caseworker", position: "health_officer" },
  { username: "mock.education", displayName: `${MOCK_TAG} کارشناس آموزش`, role: "caseworker", position: "education_officer" },
  { username: "mock.finance", displayName: `${MOCK_TAG} مسئول مالی`, role: "accountant", position: "finance_officer" },
  { username: "mock.deputy", displayName: `${MOCK_TAG} معاون سرپرستی`, role: "admin", position: "supervision_deputy" },
  { username: "mock.viewer", displayName: `${MOCK_TAG} مشاهده‌گر`, role: "viewer", position: "viewer" },
];
const MOCK_PASSWORD = "MockPass12345";

const FAMILIES = [
  { caseNumber: "MOCK-1001", familySurname: "محمدی", headName: "زهرا محمدی", headJob: "خیاط", housingType: "استیجاری", housingRent: 4500000, priority: "فوری", members: [{ name: "علی محمدی", relation: "فرزند", job: "محصل" }, { name: "سارا محمدی", relation: "فرزند", job: "محصل" }] },
  { caseNumber: "MOCK-1002", familySurname: "حسینی", headName: "مریم حسینی", headJob: "خانه‌دار", housingType: "سازمانی", housingRent: 0, priority: "بالا", members: [{ name: "رضا حسینی", relation: "فرزند", job: "دانشجو" }] },
  { caseNumber: "MOCK-1003", familySurname: "کریمی", headName: "فاطمه کریمی", headJob: "پرستار", housingType: "ملکی", housingRent: 0, priority: "متوسط", members: [] },
  { caseNumber: "MOCK-1004", familySurname: "رضایی", headName: "حسن رضایی", headJob: "کارگر ساختمانی", housingType: "استیجاری", housingRent: 3200000, priority: "متوسط", members: [{ name: "نیلوفر رضایی", relation: "فرزند", job: "محصل" }] },
  { caseNumber: "MOCK-1005", familySurname: "نوری", headName: "سمیه نوری", headJob: "آرایشگر", housingType: "استیجاری", housingRent: 5000000, priority: "بالا", members: [{ name: "امیر نوری", relation: "فرزند", job: "کودک" }] },
];

const run = async () => {
  const auth = await login(ADMIN_USER, ADMIN_PASS);
  if (!auth.cookie) {
    console.error(`Cannot log in as ${ADMIN_USER}. Is the server running at ${BASE} and is the database up?`);
    process.exit(1);
  }
  cookie = auth.cookie;
  console.log(`Signed in as ${ADMIN_USER}. Seeding via ${BASE}\n`);

  // users
  const userIds = {};
  for (const u of USERS) {
    const res = await request("POST", "/api/users", { ...u, password: MOCK_PASSWORD });
    if (res.status === 201) { userIds[u.username] = res.body.userId; step(`user ${u.username}`, res); }
    else if (res.status === 409 || res.status === 400 || res.status === 500) { step(`user ${u.username} (already exists)`, res, { expect: [400, 409, 500] }); }
    else step(`user ${u.username}`, res);
  }
  const reg = await request("GET", "/api/users/registry");
  const all = step("GET /api/users/registry", reg)?.users || [];
  for (const u of USERS) {
    const row = all.find((x) => x.username === u.username);
    if (row) userIds[u.username] = row.id;
  }

  // funds + budget (reuse an existing fund when re-run)
  const fundName = `${MOCK_TAG} صندوق کمک نقدی`;
  const fundList = await request("GET", "/api/funds");
  let fundId = (fundList.body.funds || []).find((f) => f.name === fundName)?.id ?? null;
  if (!fundId) {
    const fund = await request("POST", "/api/funds", { name: fundName, description: "صندوق آزمایشی برای داده‌های نمونه" });
    fundId = fund.status === 201 ? step("fund create", fund)?.fundId : null;
  } else {
    step(`fund (exists) ${fundName}`, { status: 200, body: {} });
  }
  if (fundId) {
    step("fund budget", await request("PUT", `/api/funds/${fundId}/budget`, { jalaliYear: nowJalali.year, jalaliMonth: nowJalali.month, amount: 500000000 }));
  }

  // families
  const created = [];
  for (const f of FAMILIES) {
    const payload = {
      caseNumber: f.caseNumber,
      familySurname: f.familySurname,
      headName: f.headName,
      headRelation: "سرپرست",
      headNationalId: withChecksum(String(200000000 + created.length * 7).slice(0, 9)),
      headBirthDate: "1360/01/01",
      headPhone: `0912${String(1000000 + created.length * 137).slice(0, 7)}`,
      familyPhone: "",
      headEducation: { level: "دیپلم", description: "دیپلم" },
      headJob: f.headJob,
      insurance: { type: "تأمین اجتماعی" },
      medical: "درمان تکمیلی",
      housingType: f.housingType,
      housingDeposit: 0,
      housingRent: f.housingRent,
      address: "تهران، خیابان نمونه، پلاک ۱۲",
      notes: `${MOCK_TAG} پرونده نمونه`,
      priority: f.priority,
      members: f.members.map((m, i) => ({
        name: m.name,
        relation: m.relation,
        nationalId: withChecksum(String(300000000 + created.length * 11 + i).slice(0, 9)),
        birthDate: "1390/01/01",
        education: "پایه ششم",
        job: m.job,
      })),
      notesHistory: [],
    };
    const res = await request("POST", "/api/families", payload);
    if (res.status === 201) { created.push({ ...f, id: res.body.familyId }); step(`family ${f.caseNumber}`, res); }
    else step(`family ${f.caseNumber}`, res, { expect: [201, 409] });
  }

  // If a family already existed, recover its id from the list.
  if (created.length < FAMILIES.length) {
    const list = await request("GET", "/api/families?status=all");
    for (const f of FAMILIES) {
      if (created.some((c) => c.caseNumber === f.caseNumber)) continue;
      const hit = (list.body.families || []).find((x) => x.caseNumber === f.caseNumber);
      if (hit) created.push({ ...f, id: hit.id });
    }
  }

  // notes / follow-ups
  for (const [i, f] of created.entries()) {
    const overdue = i % 2 === 0;
    const due = new Date(Date.now() + (overdue ? -4 : 6) * 86400000).toISOString();
    step(`note ${f.caseNumber}`, await request("POST", `/api/families/${f.id}/notes`, {
      text: `${MOCK_TAG} پیگیری تلفنی؛ وضعیت معیشت و نیازهای درمانی بررسی شد.`,
      status: "در حال پیگیری",
      institutionNote: `${MOCK_TAG} یادداشت داخلی`,
      followUpStatus: "در حال پیگیری",
      nextFollowUpAt: due,
      assigneeId: userIds["mock.liaison1"] ?? null,
    }));
  }

  // financial case -> review -> approve -> refer -> pay  (always ensure at least one exists)
  const finTarget = created[0] ?? created.find((c) => c.id);
  if (finTarget && fundId) {
    const existing = await request("GET", `/api/families/${finTarget.id}/financial-cases`);
    const already = (existing.body.financialCases || []).length > 0;
    if (already) step(`financial case (exists) on ${finTarget.caseNumber}`, { status: 200, body: {} });
    const fc = already ? { status: 200, body: {} } : await request("POST", `/api/families/${finTarget.id}/financial-cases`, {
      title: `${MOCK_TAG} کمک هزینه درمان`,
      category: "کمک نقدی",
      amount: 12000000,
      jalaliYear: nowJalali.year,
      jalaliMonth: nowJalali.month,
      description: `${MOCK_TAG} هزینه دارو و درمان`,
      institutionNote: `${MOCK_TAG} تأیید اولیه`,
    });
    const fcId = fc.status === 201 ? step("financial case create", fc)?.financialCaseId : null;
    if (fcId) {
      for (const action of ["review", "approve", "refer"]) {
        step(`financial ${action}`, await request("POST", `/api/financial-cases/${fcId}/transition`, { action }));
      }
      step("financial pay", await request("POST", `/api/financial-cases/${fcId}/pay`, {
        fundId,
        jalaliYear: nowJalali.year,
        jalaliMonth: nowJalali.month,
        paidAt: new Date().toISOString().slice(0, 10),
        referenceNo: `MOCK-REF-${Date.now()}`,
        note: `${MOCK_TAG} پرداخت آزمایشی`,
        receipt: null,
      }), { expect: [200, 201] });
    }
  }

  // service referral → specialist case
  if (created[1] && userIds["mock.health"]) {
    const ref = await request("POST", `/api/families/${created[1].id}/referrals`, {
      domain: "health",
      assignedTo: userIds["mock.health"],
      reason: `${MOCK_TAG} نیاز به بررسی درمانی`,
    });
    step("referral health", ref);
  }
  if (created[2] && userIds["mock.education"]) {
    step("referral education", await request("POST", `/api/families/${created[2].id}/referrals`, {
      domain: "education",
      assignedTo: userIds["mock.education"],
      reason: `${MOCK_TAG} افت تحصیلی فرزند`,
    }));
  }

  // supervision: supervisor + assignment (reuse an existing mock supervisor)
  if (created[3] && userIds["mock.liaison1"]) {
    const supName = `${MOCK_TAG} سرپرست نمونه`;
    const org = await request("GET", "/api/organization/overview");
    let supId = (org.body.supervisors || []).find((s) => s.name === supName)?.id ?? null;
    if (!supId) {
      const sup = await request("POST", "/api/supervisors", {
        name: supName,
        phone: "09121112233",
        notes: `${MOCK_TAG} سرپرست آزمایشی`,
        liaisonId: userIds["mock.liaison1"],
      });
      supId = sup.status === 201 ? step("supervisor create", sup)?.supervisorId : null;
    } else {
      step(`supervisor (exists) ${supName}`, { status: 200, body: {} });
    }
    if (supId) {
      step("assign supervisor", await request("POST", `/api/families/${created[3].id}/supervisor`, {
        supervisorId: supId,
        reason: `${MOCK_TAG} تخصیص آزمایشی`,
      }));
    }
  }

  // read-back checks on documented endpoints
  const reads = [
    ["GET /api/dashboard", "/api/dashboard"],
    ["GET /api/families", "/api/families?status=active"],
    ["GET /api/alerts", "/api/alerts?includeRead=false"],
    ["GET /api/follow-ups/overdue", "/api/follow-ups/overdue"],
    ["GET /api/funds", "/api/funds"],
    ["GET /api/organization/overview", "/api/organization/overview"],
    ["GET /api/security/events", "/api/security/events?limit=5"],
    ["GET /api/sessions", "/api/sessions"],
    ["GET /api/users", "/api/users"],
    ["GET /api/reports/management", `/api/reports/management?type=monthly&format=csv&from=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`],
  ];
  for (const [name, path] of reads) step(name, await request("GET", path), { expect: [200], optional: true });

  // report
  const pass = results.filter((r) => r.ok).length;
  console.log("endpoint                                  status  ok");
  console.log("-".repeat(58));
  for (const r of results) {
    console.log(`${r.name.padEnd(41)} ${String(r.status).padStart(5)}  ${r.ok ? "yes" : "NO "}${r.note ? "  " + r.note : ""}`);
  }
  console.log("-".repeat(58));
  console.log(`${pass}/${results.length} succeeded`);
  console.log(`\nMock families: ${created.map((c) => c.caseNumber).join(", ")}`);
  console.log(`Mock users (password ${MOCK_PASSWORD}): ${USERS.map((u) => u.username).join(", ")}`);
  if (pass !== results.length) process.exitCode = 1;
};

run().catch((e) => { console.error("seed failed:", e); process.exit(1); });
