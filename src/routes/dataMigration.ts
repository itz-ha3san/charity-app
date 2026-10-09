import {
  personName,
  mobile,
  optionalPhone,
  descriptiveText,
  caseNumber,
} from "../validation.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { allow, hashPassword, requireAuth } from "../auth.js";
import { pool, tx } from "../db.js";
const kind = z.enum(["liaison", "supervisor", "family", "member"]),
  row = z
    .object({
      recordType: kind,
      username: z.string().trim().max(64).optional(),
      displayName: z.string().trim().max(100).optional(),
      supervisorCode: z.string().trim().max(50).optional(),
      name: z.string().trim().max(120).optional(),
      nationalId: z.string().trim().max(10).optional(),
      phone: z.string().trim().max(30).optional(),
      notes: z.string().max(2000).optional(),
      liaisonUsername: z.string().trim().max(64).optional(),
      caseNumber: z.string().trim().max(80).optional(),
      familyCaseNumber: z.string().trim().max(80).optional(),
      familySurname: z.string().trim().max(120).optional(),
      headName: z.string().trim().max(120).optional(),
      headNationalId: z.string().trim().max(10).optional(),
      headPhone: z.string().trim().max(30).optional(),
      headBirthDate: z.string().max(30).optional(),
      familyPhone: z.string().max(30).optional(),
      headJob: z.string().max(120).optional(),
      housingType: z.string().max(80).optional(),
      housingDeposit: z.coerce.number().int().nonnegative().optional(),
      housingRent: z.coerce.number().int().nonnegative().optional(),
      address: z.string().max(1000).optional(),
      priority: z.string().max(40).optional(),
      relation: z.string().max(80).optional(),
      birthDate: z.string().max(30).optional(),
      education: z.string().max(200).optional(),
      job: z.string().max(120).optional(),
      monthlyIncome: z.coerce.number().int().nonnegative().max(9_000_000_000_000).optional(),
    })
    .passthrough();
const validNid = (v: string) => {
  if (!/^\d{10}$/.test(v) || /^(\d)\1{9}$/.test(v)) return false;
  const r =
      v
        .slice(0, 9)
        .split("")
        .reduce((n, d, i) => n + Number(d) * (10 - i), 0) % 11,
    c = Number(v[9]);
  return r < 2 ? c === r : c === 11 - r;
};
function validate(
  r: z.infer<typeof row>,
  i: number,
  seen: {
    cases: Set<string>;
    nids: Set<string>;
    users: Set<string>;
    supervisors: Set<string>;
  },
) {
  const e: string[] = [];
  const check = (schema: z.ZodTypeAny, value: unknown, error: string) => {
    if (!schema.safeParse(value).success) e.push(error);
  };
  if (["supervisor", "member"].includes(r.recordType)) {
    check(personName, r.name, "INVALID_NAME");
    check(optionalPhone, r.phone ?? "", "INVALID_PHONE");
  }
  if (r.recordType === "family") {
    check(caseNumber, r.caseNumber, "CASE_NUMBER_1_TO_999");
    check(personName, r.familySurname, "INVALID_SURNAME");
    check(personName, r.headName, "INVALID_HEAD_NAME");
    check(mobile, r.headPhone, "INVALID_MOBILE");
    check(optionalPhone, r.familyPhone ?? "", "INVALID_PHONE");
    check(descriptiveText, r.headJob ?? "", "INVALID_JOB");
  }
  if (r.recordType === "member") {
    check(descriptiveText, r.job ?? "", "INVALID_JOB");
    check(descriptiveText, r.education ?? "", "INVALID_EDUCATION");
  }

  if (r.recordType === "liaison") {
    if (!r.username || r.username.length < 3) e.push("USERNAME_REQUIRED");
    if (!r.displayName || r.displayName.length < 2)
      e.push("DISPLAY_NAME_REQUIRED");
    if (r.username && seen.users.has(r.username.toLowerCase()))
      e.push("DUPLICATE_USERNAME_IN_FILE");
    if (r.username) seen.users.add(r.username.toLowerCase());
  }
  if (r.recordType === "supervisor") {
    if (!r.supervisorCode) e.push("SUPERVISOR_CODE_REQUIRED");
    if (!r.name || r.name.length < 2) e.push("SUPERVISOR_NAME_REQUIRED");
    if (!r.liaisonUsername) e.push("LIAISON_USERNAME_REQUIRED");
    if (r.supervisorCode && seen.supervisors.has(r.supervisorCode))
      e.push("DUPLICATE_SUPERVISOR_CODE");
    if (r.supervisorCode) seen.supervisors.add(r.supervisorCode);
    if (r.nationalId && !validNid(r.nationalId)) e.push("INVALID_NATIONAL_ID");
  }
  if (r.recordType === "family") {
    if (!r.caseNumber) e.push("CASE_NUMBER_REQUIRED");
    if (!r.familySurname) e.push("FAMILY_SURNAME_REQUIRED");
    if (!r.headName || r.headName.length < 2) e.push("HEAD_NAME_REQUIRED");
    if (!r.headNationalId || !validNid(r.headNationalId))
      e.push("INVALID_HEAD_NATIONAL_ID");
    if (!r.headPhone || r.headPhone.length < 10) e.push("HEAD_PHONE_REQUIRED");
    if (r.caseNumber && seen.cases.has(r.caseNumber))
      e.push("DUPLICATE_CASE_IN_FILE");
    if (r.caseNumber) seen.cases.add(r.caseNumber);
    if (r.headNationalId && seen.nids.has(r.headNationalId))
      e.push("DUPLICATE_NATIONAL_ID_IN_FILE");
    if (r.headNationalId) seen.nids.add(r.headNationalId);
  }
  if (r.recordType === "member") {
    if (!r.familyCaseNumber) e.push("FAMILY_CASE_NUMBER_REQUIRED");
    if (!r.name || r.name.length < 2) e.push("MEMBER_NAME_REQUIRED");
    if (!r.nationalId || !validNid(r.nationalId)) e.push("INVALID_NATIONAL_ID");
    if (r.nationalId && seen.nids.has(r.nationalId))
      e.push("DUPLICATE_NATIONAL_ID_IN_FILE");
    if (r.nationalId) seen.nids.add(r.nationalId);
  }
  return { rowNumber: i + 1, entityType: r.recordType, data: r, errors: e };
}
const csv = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const headers = [
  "recordType",
  "username",
  "displayName",
  "supervisorCode",
  "name",
  "nationalId",
  "phone",
  "notes",
  "liaisonUsername",
  "caseNumber",
  "familyCaseNumber",
  "familySurname",
  "headName",
  "headNationalId",
  "headPhone",
  "headBirthDate",
  "familyPhone",
  "headJob",
  "housingType",
  "housingDeposit",
  "housingRent",
  "address",
  "priority",
  "relation",
  "birthDate",
  "education",
  "job",
  "monthlyIncome",
];
const examples = [
  { recordType: "liaison", username: "liaison-new", displayName: "رابط جدید" },
  {
    recordType: "supervisor",
    supervisorCode: "S-001",
    name: "سرپرست نمونه",
    nationalId: "",
    phone: "09120000000",
    liaisonUsername: "liaison-new",
  },
  {
    recordType: "family",
    caseNumber: "880",
    familySurname: "نمونه",
    headName: "سرپرست خانواده",
    headNationalId: "4444444411",
    headPhone: "09120000000",
    supervisorCode: "S-001",
    housingType: "other",
    housingDeposit: 0,
    housingRent: 0,
    priority: "متوسط",
  },
  {
    recordType: "member",
    familyCaseNumber: "880",
    name: "عضو نمونه",
    nationalId: "4444444428",
    relation: "فرزند",
    monthlyIncome: 0,
  },
];
export async function registerDataMigrationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", allow("admin"));
  app.get("/data-migration/template", async (req, reply) => {
    const format = z
      .object({ format: z.enum(["csv", "excel"]).default("csv") })
      .parse(req.query);
    if (format.format === "excel") {
      const esc = (v: unknown) =>
          String(v ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;"),
        rows = [
          headers,
          ...examples.map((x) =>
            headers.map((h) => (x as Record<string, unknown>)[h] ?? ""),
          ),
        ],
        body = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Migration"><Table>${rows.map((r) => `<Row>${r.map((v) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
      reply
        .header("content-type", "application/vnd.ms-excel; charset=utf-8")
        .header(
          "content-disposition",
          "attachment; filename=data-migration-template.xls",
        );
      return reply.send(body);
    }
    const body =
      "\uFEFF" +
      [
        headers.join(","),
        ...examples.map((x) =>
          headers.map((h) => csv((x as Record<string, unknown>)[h])).join(","),
        ),
      ].join("\r\n");
    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header(
        "content-disposition",
        "attachment; filename=data-migration-template.csv",
      );
    return reply.send(body);
  });
  app.post("/data-migration/preview", async (req, reply) => {
    const b = z
        .object({
          sourceName: z.string().trim().min(1).max(240),
          sourceType: z.enum(["excel", "csv", "json", "legacy"]),
          rows: z.array(z.unknown()).min(1).max(5000),
        })
        .parse(req.body),
      parsed = b.rows.map((x, i) => {
        const p = row.safeParse(x);
        return p.success
          ? { ok: true as const, value: p.data, index: i }
          : { ok: false as const, index: i, issues: p.error.issues };
      }),
      seen = {
        cases: new Set<string>(),
        nids: new Set<string>(),
        users: new Set<string>(),
        supervisors: new Set<string>(),
      },
      checked = parsed.map((x) =>
        x.ok
          ? validate(x.value, x.index, seen)
          : {
              rowNumber: x.index + 1,
              entityType: String(
                (b.rows[x.index] as any)?.recordType ?? "family",
              ),
              data: b.rows[x.index],
              errors: x.issues.map((y) => y.message),
            },
      );
    const cases = checked
        .filter((x) => x.entityType === "family")
        .map((x) => (x.data as any).caseNumber)
        .filter(Boolean),
      nids = checked
        .flatMap((x) => [
          (x.data as any).headNationalId,
          (x.data as any).nationalId,
        ])
        .filter(Boolean),
      users = checked
        .filter((x) => x.entityType === "liaison")
        .map((x) => String((x.data as any).username ?? "").toLowerCase())
        .filter(Boolean),
      db = await pool.query(
        `SELECT 'caseNumber' kind,case_number value FROM families WHERE case_number=ANY($1::text[]) UNION ALL SELECT 'nationalId',head_national_id FROM families WHERE head_national_id=ANY($2::text[]) UNION ALL SELECT 'nationalId',national_id FROM family_members WHERE national_id=ANY($2::text[]) UNION ALL SELECT 'username',username FROM users WHERE username=ANY($3::text[])`,
        [cases, nids, users],
      ),
      conflicts = new Map<string, Set<string>>();
    for (const x of db.rows) {
      if (!conflicts.has(x.kind)) conflicts.set(x.kind, new Set());
      conflicts.get(x.kind)!.add(x.value);
    }
    const liaisonRefs = checked
        .filter((x) => x.entityType === "supervisor")
        .map((x) => String((x.data as any).liaisonUsername ?? "").toLowerCase())
        .filter(Boolean),
      familyRefs = checked
        .filter((x) => x.entityType === "member")
        .map((x) => String((x.data as any).familyCaseNumber ?? ""))
        .filter(Boolean),
      existingLiaisons = new Set(
        (
          await pool.query(
            "SELECT username FROM users WHERE username=ANY($1::text[]) AND active AND position='liaison'",
            [liaisonRefs],
          )
        ).rows.map((x) => x.username),
      ),
      existingFamilies = new Set(
        (
          await pool.query(
            "SELECT case_number FROM families WHERE case_number=ANY($1::text[])",
            [familyRefs],
          )
        ).rows.map((x) => x.case_number),
      ),
      incomingLiaisons = new Set(
        checked
          .filter((x) => x.entityType === "liaison" && !x.errors.length)
          .map((x) => String((x.data as any).username ?? "").toLowerCase()),
      ),
      incomingFamilies = new Set(
        checked
          .filter((x) => x.entityType === "family" && !x.errors.length)
          .map((x) => String((x.data as any).caseNumber ?? "")),
      ),
      incomingSupervisors = new Set(
        checked
          .filter((x) => x.entityType === "supervisor" && !x.errors.length)
          .map((x) => String((x.data as any).supervisorCode ?? "")),
      );
    for (const x of checked) {
      const d = x.data as any;
      if (conflicts.get("caseNumber")?.has(d.caseNumber))
        x.errors.push("CASE_NUMBER_EXISTS");
      if (
        conflicts.get("nationalId")?.has(d.headNationalId) ||
        conflicts.get("nationalId")?.has(d.nationalId)
      )
        x.errors.push("NATIONAL_ID_EXISTS");
      if (
        conflicts.get("username")?.has(String(d.username ?? "").toLowerCase())
      )
        x.errors.push("USERNAME_EXISTS");
      if (
        x.entityType === "supervisor" &&
        !incomingLiaisons.has(String(d.liaisonUsername ?? "").toLowerCase()) &&
        !existingLiaisons.has(String(d.liaisonUsername ?? "").toLowerCase())
      )
        x.errors.push("LIAISON_NOT_FOUND");
      if (
        x.entityType === "family" &&
        d.supervisorCode &&
        !incomingSupervisors.has(String(d.supervisorCode))
      )
        x.errors.push("SUPERVISOR_CODE_NOT_FOUND");
      if (
        x.entityType === "member" &&
        !incomingFamilies.has(String(d.familyCaseNumber ?? "")) &&
        !existingFamilies.has(String(d.familyCaseNumber ?? ""))
      )
        x.errors.push("FAMILY_NOT_FOUND");
    }
    const valid = checked.filter((x) => !x.errors.length).length,
      checksum = createHash("sha256")
        .update(JSON.stringify(b.rows))
        .digest("hex"),
      id = await tx(async (c) => {
        const q = await c.query(
          "INSERT INTO data_import_batches(source_name,source_type,source_checksum,total_rows,valid_rows,invalid_rows,created_by,summary)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id",
          [
            b.sourceName,
            b.sourceType,
            checksum,
            checked.length,
            valid,
            checked.length - valid,
            req.actor!.id,
            {
              entities: Object.fromEntries(
                ["liaison", "supervisor", "family", "member"].map((k) => [
                  k,
                  checked.filter((x) => x.entityType === k).length,
                ]),
              ),
            },
          ],
        );
        for (const x of checked)
          await c.query(
            "INSERT INTO data_import_rows(batch_id,row_number,entity_type,source_row,normalized_data,status,errors)VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              q.rows[0].id,
              x.rowNumber,
              ["liaison", "supervisor", "family", "member"].includes(
                x.entityType,
              )
                ? x.entityType
                : "family",
              x.data,
              x.data,
              x.errors.length ? "invalid" : "valid",
              JSON.stringify(x.errors),
            ],
          );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)VALUES($1,'data_migration.preview','import_batch',$2,$3)",
          [
            req.actor!.id,
            q.rows[0].id,
            {
              sourceName: b.sourceName,
              total: checked.length,
              valid,
              invalid: checked.length - valid,
            },
          ],
        );
        return q.rows[0].id;
      });
    return reply.code(201).send({
      batchId: id,
      total: checked.length,
      valid,
      invalid: checked.length - valid,
      canExecute: valid === checked.length,
      rows: checked,
    });
  });
  app.post("/data-migration/batches/:id/execute", async (req, reply) => {
    const id = z
        .string()
        .uuid()
        .parse((req.params as { id: string }).id),
      result = await tx(async (c) => {
        const batch = await c.query(
          "SELECT * FROM data_import_batches WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!batch.rowCount)
          return { error: "IMPORT_BATCH_NOT_FOUND", code: 404 };
        if (batch.rows[0].status !== "previewed")
          return { error: "IMPORT_BATCH_NOT_EXECUTABLE", code: 409 };
        if (batch.rows[0].invalid_rows > 0)
          return { error: "IMPORT_BATCH_HAS_ERRORS", code: 409 };
        const rows = (
            await c.query(
              "SELECT * FROM data_import_rows WHERE batch_id=$1 ORDER BY row_number",
              [id],
            )
          ).rows,
          liaisons = new Map<string, string>(),
          supervisors = new Map<string, string>(),
          families = new Map<string, string>(),
          temporaryCredentials: {
            username: string;
            temporaryPassword: string;
          }[] = [];
        for (const x of rows.filter((x) => x.entity_type === "liaison")) {
          const d = x.normalized_data,
            pwd = `Tmp${randomBytes(9).toString("base64url")}7a`,
            q = await c.query(
              "INSERT INTO users(username,display_name,password_hash,role,position,must_change_password,import_batch_id)VALUES($1,$2,$3,'caseworker','liaison',true,$4)RETURNING id",
              [
                d.username.toLowerCase(),
                d.displayName,
                await hashPassword(pwd),
                id,
              ],
            );
          liaisons.set(d.username.toLowerCase(), q.rows[0].id);
          temporaryCredentials.push({
            username: d.username.toLowerCase(),
            temporaryPassword: pwd,
          });
          await c.query(
            "UPDATE data_import_rows SET status='imported',target_id=$2 WHERE id=$1",
            [x.id, q.rows[0].id],
          );
        }
        for (const x of rows.filter((x) => x.entity_type === "supervisor")) {
          const d = x.normalized_data,
            liaisonId =
              liaisons.get(d.liaisonUsername.toLowerCase()) ??
              (
                await c.query(
                  "SELECT id FROM users WHERE username=$1 AND active AND position='liaison'",
                  [d.liaisonUsername.toLowerCase()],
                )
              ).rows[0]?.id;
          if (!liaisonId) throw Error("MIGRATION_LIAISON_DISAPPEARED");
          const q = await c.query(
            "INSERT INTO supervisors(name,national_id,phone,notes,liaison_id,created_by,import_batch_id)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING id",
            [
              d.name,
              d.nationalId || null,
              d.phone || "",
              d.notes || "",
              liaisonId,
              req.actor!.id,
              id,
            ],
          );
          supervisors.set(d.supervisorCode, q.rows[0].id);
          await c.query(
            "UPDATE data_import_rows SET status='imported',target_id=$2 WHERE id=$1",
            [x.id, q.rows[0].id],
          );
        }
        for (const x of rows.filter((x) => x.entity_type === "family")) {
          const d = x.normalized_data,
            q = await c.query(
              `INSERT INTO families(case_number,family_surname,head_name,head_national_id,head_birth_date,head_phone,family_phone,head_education,head_job,insurance,housing_type,housing_deposit,housing_rent,address,notes,priority,created_by,profile_data,approval_status,import_batch_id,import_source)VALUES($1,$2,$3,$4,$5,$6,$7,'{}',$8,'{}',$9,$10,$11,$12,$13,$14,$15,$16,'approved',$17,$18)RETURNING id`,
              [
                d.caseNumber,
                d.familySurname,
                d.headName,
                d.headNationalId,
                d.headBirthDate || "",
                d.headPhone,
                d.familyPhone || "",
                d.headJob || "",
                d.housingType || "other",
                ["owned","ملکی","owner"].includes(d.housingType)?0:(d.housingDeposit || 0),
                ["owned","ملکی","owner"].includes(d.housingType)?0:(d.housingRent || 0),
                d.address || "",
                d.notes || "",
                d.priority || "متوسط",
                req.actor!.id,
                d,
                id,
                batch.rows[0].source_name,
              ],
            );
          families.set(d.caseNumber, q.rows[0].id);
          await c.query(
            "UPDATE data_import_rows SET status='imported',target_id=$2 WHERE id=$1",
            [x.id, q.rows[0].id],
          );
          if (d.supervisorCode) {
            const sid = supervisors.get(d.supervisorCode);
            if (!sid) throw Error("MIGRATION_SUPERVISOR_DISAPPEARED");
            await c.query(
              "INSERT INTO family_supervisor_assignments(family_id,supervisor_id,assigned_by,reason)VALUES($1,$2,$3,'مهاجرت داده C.10')",
              [q.rows[0].id, sid, req.actor!.id],
            );
            await c.query(
              "INSERT INTO family_supervision_plans(family_id,next_due_at,updated_by)VALUES($1,current_date+7,$2)ON CONFLICT(family_id)DO NOTHING",
              [q.rows[0].id, req.actor!.id],
            );
          }
        }
        for (const x of rows.filter((x) => x.entity_type === "member")) {
          const d = x.normalized_data,
            fid =
              families.get(d.familyCaseNumber) ??
              (
                await c.query("SELECT id FROM families WHERE case_number=$1", [
                  d.familyCaseNumber,
                ])
              ).rows[0]?.id;
          if (!fid) throw Error("MIGRATION_FAMILY_DISAPPEARED");
          const q = await c.query(
            "INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income,import_batch_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)RETURNING id",
            [
              fid,
              d.name,
              d.relation || "",
              d.nationalId,
              d.birthDate || "",
              { description: d.education || "" },
              d.job || "",
              d.monthlyIncome ?? 0,
              id,
            ],
          );
          await c.query(
            "UPDATE data_import_rows SET status='imported',target_id=$2 WHERE id=$1",
            [x.id, q.rows[0].id],
          );
        }
        await c.query(
          "UPDATE data_import_batches SET status='completed',imported_rows=total_rows,executed_at=now(),summary=summary||$2::jsonb WHERE id=$1",
          [id, { temporaryCredentialCount: temporaryCredentials.length }],
        );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)VALUES($1,'data_migration.execute','import_batch',$2,$3)",
          [
            req.actor!.id,
            id,
            { sourceName: batch.rows[0].source_name, imported: rows.length },
          ],
        );
        return { batchId: id, imported: rows.length, temporaryCredentials };
      });
    if ("error" in result)
      return reply.code(result.code as 404 | 409).send(result);
    return result;
  });
  app.get("/data-migration/batches", async () => {
    const q = await pool.query(
      `SELECT b.id,b.source_name "sourceName",b.source_type "sourceType",b.status,b.total_rows "total",b.valid_rows "valid",b.invalid_rows "invalid",b.imported_rows "imported",b.summary,b.created_at "createdAt",b.executed_at "executedAt",u.display_name "createdBy" FROM data_import_batches b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.created_at DESC LIMIT 100`,
    );
    return { batches: q.rows };
  });
  app.get("/data-migration/batches/:id/report", async (req, reply) => {
    const id = z
        .string()
        .uuid()
        .parse((req.params as { id: string }).id),
      b = await pool.query(
        `SELECT id,source_name "sourceName",source_type "sourceType",status,total_rows "total",valid_rows "valid",invalid_rows "invalid",imported_rows "imported",summary,created_at "createdAt",executed_at "executedAt" FROM data_import_batches WHERE id=$1`,
        [id],
      );
    if (!b.rowCount)
      return reply.code(404).send({ error: "IMPORT_BATCH_NOT_FOUND" });
    const rows = await pool.query(
      `SELECT row_number "rowNumber",entity_type "entityType",status,errors,target_id "targetId" FROM data_import_rows WHERE batch_id=$1 ORDER BY row_number`,
      [id],
    );
    const counts = await pool.query(
      `SELECT entity_type "entityType",status,count(*)::int count FROM data_import_rows WHERE batch_id=$1 GROUP BY entity_type,status ORDER BY entity_type,status`,
      [id],
    );
    return { batch: b.rows[0], rows: rows.rows, reconciliation: counts.rows };
  });
}
