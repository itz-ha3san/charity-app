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
