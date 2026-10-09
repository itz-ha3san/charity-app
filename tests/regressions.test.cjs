// Offline unit/route-contract tests. Database calls and hashing are mocked;
// these do not replace PostgreSQL integration tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = process.env.TS_TEST_PATH
  ? require(process.env.TS_TEST_PATH)
  : require("typescript");
const zod = process.env.ZOD_TEST_PATH
  ? require(process.env.ZOD_TEST_PATH)
  : require("zod");
const root = path.resolve(__dirname, "..");
let query = async () => ({ rows: [], rowCount: 0 });
const pool = { query: (...a) => query(...a) };
const cache = new Map();
const config = {
  NODE_ENV: "test",
  SESSION_TTL_HOURS: 8,
  COOKIE_SECURE: false,
  DEV_CAPTURE_PASSWORDS: false,
};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const src = fs
    .readFileSync(file, "utf8")
    .replace("const require=createRequire(import.meta.url);", "");
  const result = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  assert.equal(
    result.diagnostics?.filter(
      (x) => x.category === ts.DiagnosticCategory.Error,
    ).length || 0,
    0,
    file,
  );
  const localRequire = (name) => {
    if (name === "zod") return zod;
    if (name === "argon2")
      return {
        hash: async (x) => "hash:" + x,
        verify: async (h, p) => h === "hash:" + p,
        argon2id: 2,
      };
    if (name.endsWith("/db.js")) return { pool, tx: async (cb) => cb(pool) };
    if (name.endsWith("/config.js")) return { config };
    if (name.endsWith("/security.js"))
      return {
        securityEvent: async () => {},
        inspectFile: () => ({ ok: true }),
        accessReason: () => "",
        recordSensitiveAccess: async () => {},
      };
    if (name.startsWith(".")) {
      const f = path.resolve(path.dirname(file), name);
      if (f.endsWith(".cjs")) return require(f);
      return load(f.replace(/\.js$/, ".ts"));
    }
    return require(name);
  };
  vm.runInThisContext(
    "(function(require,module,exports){" + result.outputText + "\n})",
    { filename: file },
  )(localRequire, module, module.exports);
  return module.exports;
}
const validation = load(path.join(root, "src/validation.ts")),
  auth = load(path.join(root, "src/auth.ts")),
  family = load(path.join(root, "src/routes/families.ts")),
  supervisors = load(path.join(root, "src/supervisors.ts"));
function reply() {
  return {
    statusCode: 200,
    body: null,
    code(n) {
      this.statusCode = n;
      return this;
    },
    send(x) {
      this.body = x;
      return this;
    },
    clearCookie() {},
    setCookie() {},
  };
}
async function routes(file, name) {
  const map = new Map();
  const app = { addHook() {} };
  for (const method of ["get", "post", "patch", "delete", "put"])
    app[method] = (url, opt, fn) => {
      map.set(method + ":" + url, {
        handler: fn || opt,
        options: fn ? opt : {},
      });
    };
  await load(path.join(root, file))[name](app);
  return map;
}
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  F = "33333333-3333-4333-8333-333333333333";
const actor = { id: A, role: "admin", position: "ceo", isSuperAdmin: true };
test("all TypeScript source files parse and transpile", () => {
  function scan(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) scan(f);
      else if (f.endsWith(".ts")) {
        const diagnostics =
          ts.transpileModule(fs.readFileSync(f, "utf8"), {
            compilerOptions: {
              module: ts.ModuleKind.NodeNext,
              target: ts.ScriptTarget.ES2022,
            },
            fileName: f,
            reportDiagnostics: true,
          }).diagnostics || [];
        assert.equal(
          diagnostics.filter((x) => x.category === ts.DiagnosticCategory.Error)
            .length,
          0,
          f,
        );
      }
    }
  }
  scan(path.join(root, "src"));
});
test("names reject Latin, Persian and Arabic digits but accept Persian letters/ZWNJ", () => {
  for (const v of ["نام 1", "نام ۱", "نام ١", "123", "نام @"])
    assert.equal(validation.personName.safeParse(v).success, false, v);
  for (const v of ["علی رضایی", "محمد‌رضا", "Jean-Pierre"])
    assert.equal(validation.personName.safeParse(v).success, true, v);
});
test("job and education disallow digits and more than 120 characters", () => {
  for (const v of ["مهندس 1", "کلاس ۱۲", "x".repeat(121)])
    assert.equal(validation.descriptiveText.safeParse(v).success, false);
  assert.equal(
    validation.education.safeParse({
      level: "کارشناسی",
      description: "رشته علوم",
    }).success,
    true,
  );
  assert.equal(
    validation.education.safeParse({ level: "کلاس ۱۲" }).success,
    false,
  );
});
test("phone format is strict and Persian digits normalize", () => {
  assert.equal(validation.mobile.parse("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567");
  for (const v of [
    "abc09121234567",
    "0912123456",
    "99121234567",
    "091212345678",
  ])
    assert.equal(validation.mobile.safeParse(v).success, false);
  assert.equal(validation.optionalPhone.parse(""), "");
  assert.equal(validation.optionalPhone.safeParse("02112345678").success, true);
  assert.equal(validation.optionalPhone.safeParse("0211234567").success, false);
});
test("case numbers bounded 1..999; names validate inside full family input", () => {
  for (const v of ["1", "۹۹۹", "١٢٣"])
    assert.equal(validation.caseNumber.safeParse(v).success, true);
  for (const v of ["0", "9999", "123456", "ABC", "01"])
    assert.equal(validation.caseNumber.safeParse(v).success, false);
  const b = {
    caseNumber: "123",
    familySurname: "خانواده نمونه",
    headName: "سرپرست نمونه",
    headNationalId: "1000000011",
    headPhone: "09121234567",
  };
  assert.equal(family.familyInput.safeParse(b).success, true);
  assert.equal(
    family.familyInput.safeParse({ ...b, headName: "سرپرست ۱" }).success,
    false,
  );
});
test("approving a case-number-only liaison request never rewrites family members", async () => {
  const route = (
    await routes("src/routes/approvals.ts", "registerApprovalRoutes")
  ).get("post:/family-change-requests/:id/review");
  const calls = [];
  const snapshot = {
    caseNumber: "2",
    familySurname: "خانواده نمونه",
    headName: "سرپرست نمونه",
    headNationalId: "1000000011",
    headPhone: "09121234567",
    members: [
      {
        name: "عضو نمونه",
        relation: "فرزند",
        nationalId: "1234567891",
        birthDate: "1390/01/01",
        education: "ابتدایی",
        job: "محصل",
        monthlyIncome: 0,
      },
    ],
  };
  query = async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith("SELECT c.*,f.case_number,f.archived"))
      return {
        rows: [
          {
            id: F,
            family_id: B,
            case_number: "001",
            archived: false,
            status: "pending",
            proposed_data: {
              version: 3,
              changedFields: ["caseNumber"],
              patch: { caseNumber: "2" },
              snapshot,
            },
          },
        ],
        rowCount: 1,
      };
    return { rows: [], rowCount: 1 };
  };
  const result = await route.handler(
    {
      actor,
      params: { id: F },
      body: { decision: "approve", note: "تأیید شماره پرونده" },
    },
    reply(),
  );
  assert.equal(result.status, "approved");
  assert.ok(
    calls.some(([sql]) => sql.startsWith("UPDATE families SET case_number=")),
  );
  assert.ok(
    !calls.some(([sql]) => sql.startsWith("DELETE FROM family_members")),
  );
  assert.ok(
    !calls.some(([sql]) => sql.startsWith("INSERT INTO family_members")),
  );
});
test("older full-snapshot change requests cannot be approved", async () => {
  const route = (
    await routes("src/routes/approvals.ts", "registerApprovalRoutes")
  ).get("post:/family-change-requests/:id/review");
  query = async (sql) =>
    sql.startsWith("SELECT c.*,f.case_number,f.archived")
      ? {
          rows: [
            {
              id: F,
              family_id: B,
              case_number: "001",
              archived: false,
              status: "pending",
              proposed_data: {
                version: 2,
                changedFields: ["caseNumber", "members"],
                patch: { caseNumber: "2", members: [] },
                snapshot: {},
              },
            },
          ],
          rowCount: 1,
        }
      : { rows: [], rowCount: 1 };
  const response = reply();
  await route.handler(
    {
      actor,
      params: { id: F },
      body: { decision: "approve", note: "تأیید درخواست قدیمی" },
    },
    response,
  );
  assert.equal(response.statusCode, 409);
  assert.equal(
    response.body.error,
    "LEGACY_CHANGE_REQUEST_REQUIRES_RESUBMISSION",
  );
});
test("liaison case-number edits persist only the named field even when form sends a full snapshot", async () => {
  const route = (
    await routes("src/routes/families.ts", "registerFamilyRoutes")
  ).get("patch:/families/:id");
  const calls = [];
  const member = {
    name: "عضو نمونه",
    relation: "فرزند",
    nationalId: "1234567891",
    birthDate: "1390/01/01",
    education: "ابتدایی",
    job: "محصل",
    monthlyIncome: "0",
  };
  query = async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith("SELECT 1 FROM families f LEFT JOIN family_supervisor"))
      return { rows: [{ "?column?": 1 }], rowCount: 1 };
    if (sql.startsWith("SELECT id,case_number,family_surname"))
      return {
        rows: [
          {
            id: F,
            case_number: "1",
            family_surname: "خانواده نمونه",
            head_name: "سرپرست نمونه",
            head_national_id: "1000000011",
            head_birth_date: "1360/01/01",
            head_phone: "09121234567",
            head_card_number: "",
            family_phone: "",
            head_education: "",
            head_job: "",
            insurance: {},
            housing_type: "rent",
            housing_deposit: 1000,
            housing_rent: 500,
            address: "",
            notes: "",
            priority: "متوسط",
            archived: false,
            profile_data: {},
          },
        ],
        rowCount: 1,
      };
    if (sql.startsWith("SELECT name,relation,national_id"))
      return { rows: [member], rowCount: 1 };
    if (sql.startsWith("SELECT supervisor_id FROM family_supervisor"))
      return { rows: [], rowCount: 0 };
    if (sql.startsWith("SELECT 'caseNumber' type"))
      return { rows: [], rowCount: 0 };
    if (sql.startsWith("SELECT id FROM families WHERE id=$1 FOR UPDATE"))
      return { rows: [{ id: F }], rowCount: 1 };
    if (sql.startsWith("SELECT id,proposed_data FROM family_change_requests"))
      return { rows: [], rowCount: 0 };
    if (sql.startsWith("INSERT INTO family_change_requests"))
      return { rows: [{ id: B }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const response = reply();
  await route.handler(
    {
      actor: { ...actor, role: "caseworker", position: "liaison" },
      params: { id: F },
      body: {
        changedFields: ["caseNumber"],
        proposedData: {
          caseNumber: "2",
          // Simulate an old/buggy form serialization that alters unrelated
          // member data: the server must ignore it because the field was not
          // explicitly edited.
          members: [
            { ...member, name: "نام خراب‌شده", nationalId: "9876543210" },
          ],
        },
      },
    },
    response,
  );
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.status, "pending");
  const insert = calls.find(([sql]) =>
    sql.startsWith("INSERT INTO family_change_requests"),
  );
  assert.equal(insert[1][2].version, 3);
  assert.deepEqual(insert[1][2].changedFields, ["caseNumber"]);
  assert.deepEqual(insert[1][2].patch, { caseNumber: "2" });
  assert.equal(insert[1][2].snapshot.members[0].name, member.name);
});
test("owned housing always zeroes deposit and rent server-side", () => {
  const f = {
    housingType: "owned",
    housingDeposit: 123,
    housingRent: 456,
    housing: { deposit: 123, rent: 456, area: 60 },
  };
  family.normalizeHousing(f);
  assert.equal(f.housingRent, 0);
  assert.equal(f.housingDeposit, 0);
  assert.equal(f.housing.rent, 0);
  assert.equal(f.housing.area, 60);
});
test("Audit denied to normal admin, allowed to super admin on actual routes", async () => {
  for (const [file, name, urls] of [
    [
      "src/routes/families.ts",
      "registerFamilyRoutes",
      ["get:/families/:id/audit"],
    ],
    [
      "src/routes/operations.ts",
      "registerOperationsRoutes",
      ["get:/users/:id/audit", "get:/users/registry"],
    ],
    [
      "src/routes/security.ts",
      "registerSecurityRoutes",
      ["get:/security/events", "get:/security/sensitive-access"],
    ],
  ]) {
    const map = await routes(file, name);
    for (const url of urls) {
      const guard = map.get(url).options.preHandler;
      assert.equal(guard, auth.requireSuperAdmin);
      const r = reply();
      await guard({ actor: { ...actor, isSuperAdmin: false } }, r);
      assert.equal(r.statusCode, 403);
      const yes = reply();
      await guard({ actor }, yes);
      assert.equal(yes.statusCode, 200);
    }
  }
});
test("self profile needs current password and ignores no privileged fields", async () => {
  const map = await routes("src/routes/auth.ts", "registerAuthRoutes"),
    route = map.get("patch:/auth/profile");
  query = async (s) =>
    s.startsWith("SELECT username")
      ? {
          rowCount: 1,
          rows: [{ username: "admin", password_hash: "hash:CurrentPass123" }],
        }
      : { rows: [], rowCount: 1 };
  const bad = reply();
  await route.handler(
    {
      actor,
      cookies: { sid: "token" },
      body: {
        username: "newuser",
        displayName: "مدیر جدید",
        currentPassword: "WrongPass123",
      },
    },
    bad,
  );
  assert.equal(bad.statusCode, 400);
  const calls = [];
  query = async (s, p) => {
    calls.push([s, p]);
    return s.startsWith("SELECT username")
      ? {
          rowCount: 1,
          rows: [{ username: "admin", password_hash: "hash:CurrentPass123" }],
        }
      : { rows: [], rowCount: 1 };
  };
  const ok = await route.handler(
    {
      actor,
      cookies: { sid: "token" },
      body: {
        username: "newuser",
        displayName: "مدیر جدید",
        currentPassword: "CurrentPass123",
      },
    },
    reply(),
  );
  assert.equal(ok.updated, true);
  assert.ok(calls.some(([s]) => s.startsWith("DELETE FROM sessions")));
  assert.ok(!calls.some(([s]) => s.includes("SET is_super_admin")));
  await assert.rejects(() =>
    route.handler(
      {
        actor,
        cookies: { sid: "token" },
        body: {
          username: "newuser",
          displayName: "مدیر جدید",
          currentPassword: "CurrentPass123",
          isSuperAdmin: true,
        },
      },
      reply(),
    ),
  );
});
test("password change revokes all sessions and never writes plaintext", async () => {
  const route = (await routes("src/routes/auth.ts", "registerAuthRoutes")).get(
    "post:/auth/change-password",
  );
  const calls = [];
  query = async (s, p) => {
    calls.push([s, p]);
    return s.startsWith("SELECT password_hash")
      ? {
          rowCount: 1,
          rows: [{ username: "admin", password_hash: "hash:CurrentPass123" }],
        }
      : { rows: [], rowCount: 1 };
  };
  const result = await route.handler(
    {
      actor,
      body: {
        currentPassword: "CurrentPass123",
        newPassword: "NewStrongPass123",
      },
    },
    reply(),
  );
  assert.equal(result.loginRequired, true);
  assert.ok(calls.some(([s]) => s === "DELETE FROM sessions WHERE user_id=$1"));
  assert.ok(
    calls.some(
      ([s, p]) =>
        s.startsWith("UPDATE users SET password_hash") &&
        p[1] === "hash:NewStrongPass123",
    ),
  );
});
test("supervisor removal requires explicit family disposition; destructive mode confirmation", async () => {
  const route = (
    await routes("src/routes/organization.ts", "registerOrganizationRoutes")
  ).get("delete:/supervisors/:id");
  await assert.rejects(() =>
    route.handler({ actor, params: { id: B }, body: {} }, reply()),
  );
  let r = reply();
  await route.handler(
    { actor, params: { id: B }, body: { mode: "delete_families" } },
    r,
  );
  assert.equal(r.statusCode, 400);
  r = reply();
  await route.handler(
    { actor, params: { id: B }, body: { mode: "transfer", replacementId: B } },
    r,
  );
  assert.equal(r.statusCode, 400);
});
test("pending supervisor removal preserves families and closes assignments", async () => {
  const route = (
      await routes("src/routes/organization.ts", "registerOrganizationRoutes")
    ).get("delete:/supervisors/:id"),
    calls = [];
  query = async (s, p) => {
    calls.push([s, p]);
    if (s.startsWith("SELECT id,active FROM supervisors"))
      return { rows: [{ id: B, active: true }], rowCount: 1 };
    if (s.startsWith("SELECT f.id FROM families"))
      return { rows: [{ id: F }], rowCount: 1 };
    if (s.startsWith("SELECT supervisor_id FROM"))
      return { rows: [{ supervisor_id: B }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const r = await route.handler(
    { actor, params: { id: B }, body: { mode: "pending" } },
    reply(),
  );
  assert.equal(r.deleted, true);
  assert.ok(!calls.some(([s]) => s.startsWith("DELETE FROM families")));
  assert.ok(
    calls.some(([s]) =>
      s.startsWith("UPDATE family_supervisor_assignments SET ends_at"),
    ),
  );
  assert.ok(
    calls.some(([s]) => s.startsWith("UPDATE supervisors SET active=false")),
  );
});
test("family supervisor selection cannot use inactive/out-of-scope supervisor", async () => {
  query = async () => ({ rows: [], rowCount: 0 });
  await assert.rejects(() => supervisors.applySupervisor(pool, actor, F, B));
  query = async (s) =>
    s.startsWith("SELECT id,liaison_id")
      ? { rows: [{ id: B, liaison_id: B }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  await assert.rejects(() =>
    supervisors.applySupervisor(
      pool,
      { ...actor, role: "caseworker", position: "liaison" },
      F,
      B,
    ),
  );
});

test("liaison cannot assign family supervisor or specialist referral", async () => {
  const org = await routes("src/routes/organization.ts", "registerOrganizationRoutes");
  const liaison = { id: A, role: "caseworker", position: "liaison" };
  let r = reply();
  await org.get("post:/families/:id/supervisor").handler(
    { actor: liaison, params: { id: F }, body: { supervisorId: B } },
    r,
  );
  assert.equal(r.statusCode, 403);
  query = async (sql) => sql.startsWith("SELECT 1 FROM families f LEFT JOIN")
    ? { rows: [{ ok: 1 }], rowCount: 1 }
    : { rows: [], rowCount: 0 };
  r = reply();
  await org.get("post:/families/:id/referrals").handler(
    { actor: liaison, params: { id: F }, body: {} },
    r,
  );
  assert.equal(r.statusCode, 403);
});

test("liaison follow-up is always open and assigned to its author", async () => {
  const route = (await routes("src/routes/operations.ts", "registerOperationsRoutes"))
    .get("post:/families/:id/notes");
  const liaison = { id: A, role: "caseworker", position: "liaison" };
  const calls = [];
  query = async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith("SELECT id,case_number,archived,assigned_to FROM families"))
      return { rows: [{ id: F, case_number: "1", archived: false, assigned_to: A }], rowCount: 1 };
    if (sql.startsWith("SELECT 1 FROM families f LEFT JOIN family_supervisor_assignments"))
      return { rows: [{ ok: 1 }], rowCount: 1 };
    if (sql.startsWith("SELECT id FROM users WHERE id=$1 AND active"))
      return { rows: [{ id: A }], rowCount: 1 };
    if (sql.startsWith("INSERT INTO notes"))
      return { rows: [{ id: B }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const r = reply();
  const result = await route.handler({
    actor: liaison,
    params: { id: F },
    body: { text: "با خانواده تماس گرفته شد", followUpStatus: "انجام شد", assigneeId: B },
  }, r);
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.noteId, B);
  const insert = calls.find(([sql]) => sql.startsWith("INSERT INTO notes"));
  assert.equal(insert[1][4], "باز");
  assert.equal(insert[1][6], A);
  assert.ok(!calls.some(([sql]) => sql.includes("UPDATE families SET assigned_to")));
});

test("liaison cannot edit another staff member's follow-up", async () => {
  const route = (await routes("src/routes/operations.ts", "registerOperationsRoutes"))
    .get("patch:/notes/:noteId");
  const liaison = { id: A, role: "caseworker", position: "liaison" };
  let updates = 0;
  query = async (sql) => {
    if (sql.startsWith("SELECT n.*,f.archived,f.case_number"))
      return { rows: [{ id: B, family_id: F, archived: false, case_number: "1", created_by: B, assignee_id: B }], rowCount: 1 };
    if (sql.startsWith("SELECT id,case_number,archived,assigned_to FROM families"))
      return { rows: [{ id: F, case_number: "1", archived: false, assigned_to: A }], rowCount: 1 };
    if (sql.startsWith("SELECT 1 FROM families f LEFT JOIN family_supervisor_assignments"))
      return { rows: [{ ok: 1 }], rowCount: 1 };
    if (sql.startsWith("UPDATE notes")) updates++;
    return { rows: [], rowCount: 1 };
  };
  const r = reply();
  await route.handler({ actor: liaison, params: { noteId: B }, body: { followUpStatus: "انجام شد" } }, r);
  assert.equal(r.statusCode, 403);
  assert.equal(updates, 0);
});


test("liaison cannot assign a supervisor while creating a family", async () => {
  const route = (await routes("src/routes/families.ts", "registerFamilyRoutes"))
    .get("post:/families");
  const r = reply();
  await route.handler({
    actor: { id: A, role: "caseworker", position: "liaison" },
    body: {
      caseNumber: "7",
      familySurname: "خانواده نمونه",
      headName: "سرپرست نمونه",
      headNationalId: "1000000011",
      headPhone: "09121234567",
      supervisorId: B,
      members: [],
    },
  }, r);
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.error, "SUPERVISOR_ASSIGNMENT_MANAGER_ONLY");
});

test("deputies can delegate a follow-up to another active worker", async () => {
  const route = (await routes("src/routes/operations.ts", "registerOperationsRoutes"))
    .get("post:/families/:id/notes");
  const deputy = { id: A, role: "accountant", position: "finance_deputy" };
  const calls = [];
  query = async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith("SELECT id,case_number,archived,assigned_to FROM families"))
      return { rows: [{ id: F, case_number: "1", archived: false, assigned_to: null }], rowCount: 1 };
    if (sql.startsWith("SELECT id FROM users WHERE id=$1 AND active"))
      return { rows: [{ id: B }], rowCount: 1 };
    if (sql.startsWith("INSERT INTO notes"))
      return { rows: [{ id: B }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const r = reply();
  await route.handler({
    actor: deputy,
    params: { id: F },
    body: { text: "تماس برای تکمیل درخواست مالی", followUpStatus: "در حال پیگیری", assigneeId: B },
  }, r);
  assert.equal(r.statusCode, 201);
  const insert = calls.find(([sql]) => sql.startsWith("INSERT INTO notes"));
  assert.equal(insert[1][4], "در حال پیگیری");
  assert.equal(insert[1][6], B);
});

test("top quick follow-up requires family selection while family action stays preselected", () => {
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const start = html.indexOf("async function openQuickFollowupForm()");
  const end = html.indexOf("async function loadFinancialCases", start);
  const topAction = html.slice(start, end);
  assert.match(topAction, /openFamilyFollowupForm\(null\)/);
  assert.doesNotMatch(topAction, /selectedId/);
  assert.match(html, /if\(nb\)nb\.onclick=\(\)=>openFamilyFollowupForm\(f\)/);
  const operations = fs.readFileSync(path.join(root, "public/operations-experience.js"), "utf8");
  assert.doesNotMatch(operations, /function openNoteForm\(/);
  assert.doesNotMatch(operations, /window\.openNoteForm/);
});

test("family details return active tags for the family header", async () => {
  const route = (
    await routes("src/routes/families.ts", "registerFamilyRoutes")
  ).get("get:/families/:id");
  const previousQuery = query;
  query = async (sql) => {
    if (sql.includes("FROM families WHERE id=$1"))
      return {
        rows: [
          {
            id: F,
            caseNumber: "101",
            familySurname: "نمونه",
            headName: "سرپرست نمونه",
            headNationalId: "1000000011",
            headPhone: "09120000000",
            insurance: {},
            profileData: {},
          },
        ],
        rowCount: 1,
      };
    if (sql.includes("FROM family_members"))
      return { rows: [], rowCount: 0 };
    if (sql.includes("FROM notes n"))
      return { rows: [], rowCount: 0 };
    if (sql.includes("FROM family_tag_assignments"))
      return {
        rows: [{ id: B, name: "نیازمند پیگیری", color: "orange" }],
        rowCount: 1,
      };
    if (sql.includes("FROM family_supervisor_assignments"))
      return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  };
  try {
    const response = reply();
    const result = await route.handler(
      { actor, params: { id: F } },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(result.family.tags, [
      { id: B, name: "نیازمند پیگیری", color: "orange" },
    ]);
  } finally {
    query = previousQuery;
  }
});

test("liaisons can create a tag and the completion link opens the profile", async () => {
  const tagRoute = (
    await routes("src/routes/comprehensive.ts", "registerComprehensiveRoutes")
  ).get("post:/family-tags");
  const previousQuery = query;
  query = async () => ({ rows: [{ id: B }], rowCount: 1 });
  try {
    const response = reply();
    await tagRoute.handler(
      {
        actor: { id: A, role: "caseworker", position: "liaison" },
        body: { name: "نیاز درمانی", color: "green" },
      },
      response,
    );
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.tagId, B);
  } finally {
    query = previousQuery;
  }
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const ux = fs.readFileSync(path.join(root, "public/ux-system.js"), "utf8");
  assert.ok(html.includes('id="comprehensiveSection" class="full-profile"'));
  assert.ok(ux.includes("detail.querySelector('#comprehensiveSection')"));
  assert.ok(ux.includes("section.open=true"));
});
