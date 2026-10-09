import {
  personName,
  descriptiveText,
  mobile,
  optionalPhone,
  education,
  caseNumber,
} from "../validation.js";
import { applySupervisor } from "../supervisors.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool, tx } from "../db.js";
import { allow, requireAuth, requireSuperAdmin } from "../auth.js";
import {
  canViewFamily,
  canWorkFamily,
  canReadFullFamilyProfile,
  globalFamilyAccess,
  financeAccess,
} from "../scope.js";
const validId = (v: string) => {
    if (!/^\d{10}$/.test(v) || /^(\d)\1{9}$/.test(v)) return false;
    const r =
        v
          .slice(0, 9)
          .split("")
          .reduce((n, d, i) => n + Number(d) * (10 - i), 0) % 11,
      c = Number(v[9]);
    return r < 2 ? c === r : c === 11 - r;
  },
  nid = z.string().refine(validId, "INVALID_NATIONAL_ID"),
  jsonbValue = (v: unknown) =>
    v === undefined || v === null
      ? {}
      : typeof v === "string"
        ? JSON.stringify(v)
        : v,
  member = z
    .object({
      name: personName,
      relation: z.string().default(""),
      nationalId: nid,
      birthDate: z.string().default(""),
      education: education.optional(),
      job: descriptiveText.default(""),
      monthlyIncome: z.coerce.number().int().nonnegative().max(9_000_000_000_000).default(0),
    })
    .passthrough(),
  note = z
    .object({
      text: z.string().min(1),
      status: z.string().default(""),
      institutionNote: z.string().default(""),
    })
    .passthrough(),
  family = z
    .object({
      caseNumber: caseNumber,
      familySurname: personName,
      headName: personName,
      headNationalId: nid,
      headBirthDate: z.string().default(""),
      headPhone: mobile,
      headCardNumber: z
        .string()
        .regex(/^\d{16}$/)
        .or(z.literal(""))
        .default(""),
      familyPhone: optionalPhone.default(""),
      headEducation: education.optional(),
      headJob: descriptiveText.default(""),
      insurance: z.any().optional(),
      housingType: z.string().default("other"),
      housingDeposit: z.number().nonnegative().default(0),
      housingRent: z.number().nonnegative().default(0),
      address: z.string().default(""),
      notes: z.string().default(""),
      priority: z.string().default("متوسط"),
      supervisorId: z.string().uuid().nullable().optional(),
      members: z.array(member).max(100).default([]),
      notesHistory: z.array(note).default([]),
    })
    .passthrough(),
  list = z.object({
    search: z.string().trim().max(100).default(""),
    supervisorId: z.string().uuid().optional(),
    liaisonId: z.string().uuid().optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });
const liaisonEditableKeys = [
  "caseNumber",
  "familySurname",
  "headName",
  "headNationalId",
  "headBirthDate",
  "headPhone",
  "headCardNumber",
  "familyPhone",
  "headEducation",
  "headJob",
  "insurance",
  "medical",
  "incomeDescription",
  "debt",
  "transportationCost",
  "utilityCost",
  "monthlyInstallments",
  "monthlyAid",
  "sponsor",
  "nextFollowUp",
  "housingType",
  "housingDeposit",
  "housingRent",
  "housing",
  "address",
  "notes",
  "priority",
  "members",
] as const;
const liaisonEditableKey = z.enum(liaisonEditableKeys);
const technicalProposalKeys = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdById",
]);
function sameProposalValue(before: unknown, after: unknown, path = ""): boolean {
  const empty = (value: unknown) =>
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "");
  const leaf = path.split(".").pop()?.replace(/\[\d+\]/g, "") ?? "";
  if (leaf === "hasCondition")
    return Boolean(before) === Boolean(after);
  const numericKeys = new Set([
    "cost",
    "monthlyCost",
    "amount",
    "deposit",
    "rent",
    "monthlyRent",
    "housingDeposit",
    "housingRent",
    "transportationCost",
    "utilityCost",
    "monthlyInstallments",
    "monthlyAid",
    "monthlyIncome",
  ]);
  if (numericKeys.has(leaf)) {
    const number = (value: unknown) =>
      empty(value) ? 0 : Number(value);
    const a = number(before);
    const b = number(after);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  }
  if (empty(before) || empty(after)) return empty(before) && empty(after);
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) return false;
    return (
      before.length === after.length &&
      before.every((value, index) =>
        sameProposalValue(value, after[index], `${path}[${index}]`),
      )
    );
  }
  const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (isObject(before) || isObject(after)) {
    if (!isObject(before) || !isObject(after)) return false;
    const keys = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].filter((key) => !technicalProposalKeys.has(key));
    return keys.every((key) =>
      sameProposalValue(before[key], after[key], path ? `${path}.${key}` : key),
    );
  }
  if (
    typeof before === "string" &&
    typeof after === "string" &&
    /(?:date|at)$/i.test(leaf)
  )
    return before.slice(0, 10) === after.slice(0, 10);
  return String(before).trim() === String(after).trim();
}
export async function registerFamilyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/families", async (req) => {
    const q = list.parse(req.query),
      p: unknown[] = [];
    let w = "WHERE 1=1";
    if (
      !globalFamilyAccess(req.actor!) &&
      !financeAccess(req.actor!) &&
      !(req.actor!.role === "viewer" && req.actor!.position === "viewer")
    ) {
      p.push(req.actor!.id);
      if (req.actor!.position === "liaison")
        w += ` AND (EXISTS(SELECT 1 FROM family_supervisor_assignments fa JOIN supervisors s ON s.id=fa.supervisor_id WHERE fa.family_id=f.id AND fa.ends_at IS NULL AND s.active AND s.liaison_id=$${p.length}) OR f.assigned_to=$${p.length} OR (f.created_by=$${p.length} AND NOT EXISTS(SELECT 1 FROM family_supervisor_assignments ax WHERE ax.family_id=f.id AND ax.ends_at IS NULL)))`;
      else if (
        ["health_officer", "education_officer"].includes(req.actor!.position)
      )
        w += ` AND EXISTS(SELECT 1 FROM service_referrals sr WHERE sr.family_id=f.id AND sr.assigned_to=$${p.length} AND sr.status IN ('open','in_progress'))`;
      else w += " AND false";
    }
    if (q.status !== "all") {
      p.push(q.status === "archived");
      w += ` AND f.archived=$${p.length}`;
    }
    if (q.supervisorId) {
      p.push(q.supervisorId);
      w += ` AND EXISTS(SELECT 1 FROM family_supervisor_assignments fs WHERE fs.family_id=f.id AND fs.supervisor_id=$${p.length} AND fs.ends_at IS NULL)`;
    }
    if (q.liaisonId) {
      p.push(q.liaisonId);
      w += ` AND (f.assigned_to=$${p.length} OR EXISTS(SELECT 1 FROM family_supervisor_assignments lfa JOIN supervisors ls ON ls.id=lfa.supervisor_id WHERE lfa.family_id=f.id AND lfa.ends_at IS NULL AND ls.active AND ls.liaison_id=$${p.length}))`;
    }
    if (q.search) {
      p.push(`%${q.search}%`);
      w += ` AND (f.case_number ILIKE $${p.length} OR f.family_surname ILIKE $${p.length} OR f.head_name ILIKE $${p.length} OR f.head_national_id LIKE $${p.length} OR EXISTS(SELECT 1 FROM family_supervisor_assignments fs JOIN supervisors ss ON ss.id=fs.supervisor_id WHERE fs.family_id=f.id AND fs.ends_at IS NULL AND ss.name ILIKE $${p.length}))`;
    }
    p.push(q.limit, q.offset);
    const r = await pool.query(
      `SELECT f.id,f.case_number AS "caseNumber",f.family_surname AS "familySurname",f.head_name AS "headName",f.head_phone AS "headPhone",f.priority,f.archived,f.approval_status AS "approvalStatus",f.updated_at AS "updatedAt",count(m.id)::int AS "memberCount",count(*) OVER()::int AS "total" FROM families f LEFT JOIN family_members m ON m.family_id=f.id ${w} GROUP BY f.id ORDER BY f.updated_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`,
      p,
    );
    return { families: r.rows, total: r.rows[0]?.total ?? 0 };
  });

  /* ✔ GET /families/:id — استخراج فیلدهای قابل‌ویرایش از profile_data برای همه کاربران */
  app.get("/families/:id", async (req, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as { id: string }).id);
    if (!(await canViewFamily(req.actor!, id)))
      return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
    const f = await pool.query(
      `SELECT id,case_number AS "caseNumber",family_surname AS "familySurname",head_name AS "headName",head_national_id AS "headNationalId",head_birth_date AS "headBirthDate",head_phone AS "headPhone",head_card_number AS "headCardNumber",family_phone AS "familyPhone",head_education AS "headEducation",head_job AS "headJob",insurance,housing_type AS "housingType",housing_deposit AS "housingDeposit",housing_rent AS "housingRent",address,notes,priority,archived,approval_status AS "approvalStatus",approval_note AS "approvalNote",assigned_to AS "assignedTo",profile_data AS "profileData" FROM families WHERE id=$1`,
      [id],
    );
    if (!f.rowCount) return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
    const [m, n, tags] = await Promise.all([
      pool.query(
        `SELECT id,name,relation,national_id AS "nationalId",birth_date AS "birthDate",education,job,monthly_income::text AS "monthlyIncome" FROM family_members WHERE family_id=$1 ORDER BY created_at`,
        [id],
      ),
      pool.query(
        `SELECT n.id,n.body AS text,n.status,n.institution_note AS "institutionNote",n.follow_up_status AS "followUpStatus",n.next_follow_up_at AS "nextFollowUpAt",n.assignee_id AS "assigneeId",u.display_name AS "assigneeName",n.created_at AS "createdAt",n.updated_at AS "updatedAt" FROM notes n LEFT JOIN users u ON u.id=n.assignee_id WHERE n.family_id=$1 ORDER BY n.created_at DESC`,
        [id],
      ),
      pool.query(
        `SELECT t.id,t.name,t.color FROM family_tag_assignments a JOIN family_tag_definitions t ON t.id=a.tag_id WHERE a.family_id=$1 AND t.active ORDER BY t.name`,
        [id],
      ),
    ]);
    const row = f.rows[0];
    const assignment = await pool.query(
      "SELECT supervisor_id FROM family_supervisor_assignments WHERE family_id=$1 AND ends_at IS NULL",
      [id],
    );
    row.supervisorId = assignment.rows[0]?.supervisor_id ?? null;
    const pd =
      row.profileData && typeof row.profileData === "object"
        ? row.profileData
        : {};
    const insuranceDb =
      row.insurance &&
      typeof row.insurance === "object" &&
      Object.keys(row.insurance).length
        ? row.insurance
        : null;
    const insuranceFromPd =
      pd.insurance && typeof pd.insurance === "object" ? pd.insurance : null;
    const detail: Record<string, unknown> = {
      ...row,
      insurance: insuranceDb ?? insuranceFromPd ?? {},
      medical: pd.medical ?? {},
      incomeDescription: pd.incomeDescription ?? "",
      debt: pd.debt ?? {},
      transportationCost: pd.transportationCost ?? 0,
      utilityCost: pd.utilityCost ?? 0,
      monthlyInstallments: pd.monthlyInstallments ?? 0,
      monthlyAid: pd.monthlyAid ?? 0,
      sponsor: pd.sponsor ?? "",
      nextFollowUp: pd.nextFollowUp ?? "",
      housing: pd.housing ?? {},
      members: m.rows,
      notesHistory: n.rows,
      tags: tags.rows,
    };
    const mayReadFullProfile = await canReadFullFamilyProfile(req.actor!, id);
    if (!mayReadFullProfile) delete detail.profileData;
    return { family: detail };
  });

  app.get(
    "/families/:id/audit",
    { preHandler: requireSuperAdmin },
    async (req, reply) => {
      const id = z
          .string()
          .uuid()
          .parse((req.params as { id: string }).id),
        q = z
          .object({
            limit: z.coerce.number().int().min(1).max(200).default(100),
            offset: z.coerce.number().int().min(0).default(0),
          })
          .parse(req.query),
        exists = await pool.query(
          "SELECT case_number FROM families WHERE id=$1",
          [id],
        );
      if (!exists.rowCount)
        return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
      const logs = await pool.query(
        `SELECT a.id,a.action,a.details,a.created_at AS "createdAt",u.display_name AS "actorName",u.username AS "actorUsername",count(*) OVER()::int AS total FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity_type='family' AND a.entity_id=$1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
        [id, q.limit, q.offset],
      );
      return {
        events: logs.rows,
        total: logs.rows[0]?.total ?? 0,
        caseNumber: exists.rows[0].case_number,
        limit: q.limit,
        offset: q.offset,
      };
    },
  );

  app.post(
    "/families",
    { preHandler: allow("admin", "caseworker") },
    async (req, reply) => {
      if (!globalFamilyAccess(req.actor!) && req.actor!.position !== "liaison")
        return reply.code(403).send({ error: "FORBIDDEN" });
      const f = family.parse(req.body);
      normalizeHousing(f);
      if (req.actor!.position === "liaison" && f.supervisorId)
        return reply.code(403).send({ error: "SUPERVISOR_ASSIGNMENT_MANAGER_ONLY" });
      if (f.supervisorId) {
        const supervisor = await pool.query(
          "SELECT liaison_id FROM supervisors WHERE id=$1 AND active",
          [f.supervisorId],
        );
        if (
          !supervisor.rowCount ||
          (!globalFamilyAccess(req.actor!) &&
            supervisor.rows[0].liaison_id !== req.actor!.id)
        )
          return reply.code(400).send({ error: "INVALID_SUPERVISOR" });
      }
      const nids = [f.headNationalId, ...f.members.map((m) => m.nationalId)];
      if (new Set(nids).size !== nids.length)
        return reply.code(409).send({ error: "DUPLICATE_IN_FILE" });
      const ex = await pool.query(
        `SELECT 'caseNumber' type,case_number value FROM families WHERE case_number=$1 UNION ALL SELECT 'nationalId',head_national_id FROM families WHERE head_national_id=ANY($2::text[]) UNION ALL SELECT 'nationalId',national_id FROM family_members WHERE national_id=ANY($2::text[])`,
        [f.caseNumber, nids],
      );
      if (ex.rowCount)
        return reply
          .code(409)
          .send({ error: "DUPLICATE_VALUE", conflicts: ex.rows });
      const id = await tx(async (c) => {
        const q = await c.query(
          `INSERT INTO families(case_number,family_surname,head_name,head_national_id,head_birth_date,head_phone,family_phone,head_education,head_job,insurance,housing_type,housing_deposit,housing_rent,address,notes,priority,created_by,profile_data,approval_status,head_card_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
          [
            f.caseNumber,
            f.familySurname,
            f.headName,
            f.headNationalId,
            f.headBirthDate,
            f.headPhone,
            f.familyPhone,
            jsonbValue(f.headEducation),
            f.headJob,
            f.insurance ?? {},
            f.housingType,
            f.housingDeposit,
            f.housingRent,
            f.address,
            f.notes,
            f.priority,
            req.actor!.id,
            f,
            req.actor!.position === "liaison" ? "pending" : "approved",
            f.headCardNumber,
          ],
        );
        const familyId = q.rows[0].id as string;
        await applySupervisor(c, req.actor!, familyId, f.supervisorId);
        for (const m of f.members)
          await c.query(
            "INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              familyId,
              m.name,
              m.relation,
              m.nationalId,
              m.birthDate,
              jsonbValue(m.education),
              m.job,
              m.monthlyIncome ?? 0,
            ],
          );
        for (const n of f.notesHistory)
          await c.query(
            "INSERT INTO notes(family_id,body,status,institution_note,created_by) VALUES($1,$2,$3,$4,$5)",
            [familyId, n.text, n.status, n.institutionNote, req.actor!.id],
          );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.create','family',$2,$3)",
          [
            req.actor!.id,
            familyId,
            {
              caseNumber: f.caseNumber,
              memberCount: f.members.length,
              membersUpdated: true,
            },
          ],
        );
        return familyId;
      });
      return reply.code(201).send({ familyId: id });
    },
  );

  /* ✔ PATCH — همان منطق قبلی، اما اکنون profile_data را با فیلدهای جدید هم ادغام می‌کند */
  app.patch(
    "/families/:id",
    { preHandler: allow("admin", "caseworker") },
    async (req, reply) => {
      const id = z
        .string()
        .uuid()
        .parse((req.params as { id: string }).id);
      if (
        (!globalFamilyAccess(req.actor!) &&
          req.actor!.position !== "liaison") ||
        !(await canWorkFamily(req.actor!, id))
      )
        return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
      const isLiaison = req.actor!.position === "liaison";
      let proposedInput: Record<string, unknown>;
      let requestedFields: string[] = [];
      const rawBody = req.body as Record<string, unknown>;
      if (isLiaison) {
        if (
          !rawBody ||
          typeof rawBody !== "object" ||
          !Object.prototype.hasOwnProperty.call(rawBody, "proposedData")
        )
          return reply.code(400).send({ error: "CHANGED_FIELDS_REQUIRED" });
        const request = z
          .object({
            changedFields: z
              .array(liaisonEditableKey)
              .min(1)
              .max(liaisonEditableKeys.length),
            proposedData: z.record(z.unknown()),
          })
          .strict()
          .parse(rawBody);
        proposedInput = request.proposedData;
        requestedFields = [...new Set(request.changedFields)];
      } else {
        proposedInput = rawBody;
      }
      const current = await pool.query(
        "SELECT id,case_number,family_surname,head_name,head_national_id,head_birth_date,head_phone,head_card_number,family_phone,head_education,head_job,insurance,housing_type,housing_deposit,housing_rent,address,notes,priority,archived,profile_data FROM families WHERE id=$1",
        [id],
      );
      if (!current.rowCount)
        return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
      if (current.rows[0].archived)
        return reply.code(409).send({ error: "FAMILY_ARCHIVED" });
      const currentMemberRows = await pool.query(
        `SELECT name,relation,national_id AS "nationalId",birth_date AS "birthDate",education,job,monthly_income::text AS "monthlyIncome"
         FROM family_members WHERE family_id=$1 ORDER BY created_at`,
        [id],
      );
      const currentAssignment = await pool.query(
        "SELECT supervisor_id FROM family_supervisor_assignments WHERE family_id=$1 AND ends_at IS NULL",
        [id],
      );
      const row = current.rows[0];
      const profileData =
        row.profile_data &&
        typeof row.profile_data === "object" &&
        !Array.isArray(row.profile_data)
          ? (row.profile_data as Record<string, unknown>)
          : {};
      const housingProfile =
        profileData.housing &&
        typeof profileData.housing === "object" &&
        !Array.isArray(profileData.housing)
          ? (profileData.housing as Record<string, unknown>)
          : {};
      const insurance =
        row.insurance &&
        typeof row.insurance === "object" &&
        Object.keys(row.insurance).length
          ? row.insurance
          : profileData.insurance ?? {};
      const currentData: Record<string, unknown> = {
        ...profileData,
        caseNumber: row.case_number,
        familySurname: row.family_surname,
        headName: row.head_name,
        headNationalId: row.head_national_id,
        headBirthDate: row.head_birth_date ?? "",
        headPhone: row.head_phone,
        headCardNumber: row.head_card_number ?? "",
        familyPhone: row.family_phone ?? "",
        headEducation: row.head_education ?? {},
        headJob: row.head_job ?? "",
        insurance,
        medical: profileData.medical ?? {},
        incomeDescription: profileData.incomeDescription ?? "",
        debt: profileData.debt ?? {},
        transportationCost: profileData.transportationCost ?? 0,
        utilityCost: profileData.utilityCost ?? 0,
        monthlyInstallments: profileData.monthlyInstallments ?? 0,
        monthlyAid: profileData.monthlyAid ?? 0,
        sponsor: profileData.sponsor ?? "",
        nextFollowUp: profileData.nextFollowUp ?? "",
        supervisorId: currentAssignment.rows[0]?.supervisor_id ?? null,
        housingType: row.housing_type,
        housingDeposit: Number(row.housing_deposit ?? 0),
        housingRent: Number(row.housing_rent ?? 0),
        housing: {
          ...housingProfile,
          type: row.housing_type,
          deposit: Number(row.housing_deposit ?? 0),
          rent: Number(row.housing_rent ?? 0),
          address: row.address ?? "",
        },
        address: row.address ?? "",
        notes: row.notes ?? "",
        priority: row.priority,
        members: currentMemberRows.rows,
      };
      let actualChangedFields: string[] = [];
      let mergedInput: Record<string, unknown> = proposedInput;
      if (isLiaison) {
        const patch: Record<string, unknown> = {};
        for (const key of requestedFields) {
          if (!Object.prototype.hasOwnProperty.call(proposedInput, key)) continue;
          if (sameProposalValue(currentData[key], proposedInput[key], key))
            continue;
          patch[key] = proposedInput[key];
          actualChangedFields.push(key);
        }
        if (!actualChangedFields.length)
          return reply.code(409).send({ error: "NO_CHANGES" });
        mergedInput = { ...currentData, ...patch };
      }
      const f = family.omit({ notesHistory: true }).parse(mergedInput);
      const membersChanged = !sameProposalValue(
        currentData.members,
        f.members,
        "members",
      );
      if (!isLiaison || actualChangedFields.includes("housingType"))
        normalizeHousing(f);
      if (
        f.supervisorId &&
        (!isLiaison || actualChangedFields.includes("supervisorId"))
      ) {
        const supervisor = await pool.query(
          "SELECT liaison_id FROM supervisors WHERE id=$1 AND active",
          [f.supervisorId],
        );
        if (
          !supervisor.rowCount ||
          (!globalFamilyAccess(req.actor!) &&
            supervisor.rows[0].liaison_id !== req.actor!.id)
        )
          return reply.code(400).send({ error: "INVALID_SUPERVISOR" });
      }
      if (isLiaison && actualChangedFields.includes("housingType") && f.housingType === "owned") {
        f.housingDeposit = 0;
        f.housingRent = 0;
        f.housing = { ...(f.housing ?? {}), deposit: 0, rent: 0 };
        for (const key of ["housingDeposit", "housingRent", "housing"])
          if (!actualChangedFields.includes(key)) actualChangedFields.push(key);
      }
      const requestPatch: Record<string, unknown> = {};
      if (isLiaison)
        for (const key of actualChangedFields)
          requestPatch[key] = (f as unknown as Record<string, unknown>)[key];
      const nids = [f.headNationalId, ...f.members.map((m) => m.nationalId)];
      if (new Set(nids).size !== nids.length)
        return reply.code(409).send({ error: "DUPLICATE_IN_FILE" });
      const ex = await pool.query(
        `SELECT 'caseNumber' type,case_number value FROM families WHERE case_number=$1 AND id<>$3 UNION ALL SELECT 'nationalId',head_national_id FROM families WHERE head_national_id=ANY($2::text[]) AND id<>$3 UNION ALL SELECT 'nationalId',national_id FROM family_members WHERE national_id=ANY($2::text[]) AND family_id<>$3`,
        [f.caseNumber, nids, id],
      );
      if (ex.rowCount)
        return reply
          .code(409)
          .send({ error: "DUPLICATE_VALUE", conflicts: ex.rows });
      if (req.actor!.position === "liaison") {
        const requestData = {
          // Version 3 means the request is a server-validated, explicit patch.
          // Older v2 full-form snapshots must never be approved as field diffs.
          version: 3,
          changedFields: actualChangedFields,
          patch: requestPatch,
          snapshot: f,
        };
        let pending: string;
        try {
          pending = await tx(async (c) => {
            // Serialize edits for this family so repeated submissions update the
            // existing request instead of failing on the pending-request index.
            await c.query("SELECT id FROM families WHERE id=$1 FOR UPDATE", [id]);
            const existing = await c.query(
              "SELECT id,proposed_data FROM family_change_requests WHERE family_id=$1 AND status='pending' LIMIT 1 FOR UPDATE",
              [id],
            );
            let requestId: string;
            if (existing.rowCount) {
              requestId = existing.rows[0].id;
              const previous = existing.rows[0].proposed_data as
                | Record<string, unknown>
                | null;
              let storedRequestData: Record<string, unknown> = requestData;
              if (
                previous?.version === 3 &&
                previous.patch &&
                typeof previous.patch === "object" &&
                !Array.isArray(previous.patch) &&
                Array.isArray(previous.changedFields)
              ) {
                const previousPatch = {
                  ...(previous.patch as Record<string, unknown>),
                };
                // If a liaison revisits a field while a request is pending,
                // replace that proposal (or remove it when reverted to the
                // saved value) without discarding other pending edits.
                requestedFields.forEach((key) => delete previousPatch[key]);
                Object.assign(previousPatch, requestPatch);
                const untouchedPreviousFields = (
                  previous.changedFields as string[]
                ).filter((key) => !requestedFields.includes(key));
                const combinedFields = [
                  ...new Set([
                    ...untouchedPreviousFields,
                    ...actualChangedFields,
                  ]),
                ];
                storedRequestData = {
                  version: 3,
                  changedFields: combinedFields,
                  patch: previousPatch,
                  snapshot: { ...currentData, ...previousPatch },
                };
              }
              await c.query(
                "UPDATE family_change_requests SET requested_by=$2,proposed_data=$3,updated_at=now() WHERE id=$1",
                [requestId, req.actor!.id, storedRequestData],
              );
            } else {
              const q = await c.query(
                "INSERT INTO family_change_requests(family_id,requested_by,proposed_data) VALUES($1,$2,$3) RETURNING id",
                [id, req.actor!.id, requestData],
              );
              requestId = q.rows[0].id;
            }
            await c.query(
              "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.change.request','family',$2,$3)",
              [
                req.actor!.id,
                id,
                {
                  caseNumber: f.caseNumber,
                  changeRequestId: requestId,
                  status: "pending",
                changedFields: actualChangedFields,
                },
              ],
            );
            return requestId;
          });
        } catch (error) {
          const dbError = error as { code?: string; message?: string };
          if (
            dbError.code === "42P01" &&
            dbError.message?.includes("family_change_requests")
          )
            return reply
              .code(503)
              .send({ error: "MIGRATIONS_REQUIRED" });
          throw error;
        }
        return reply
          .code(202)
          .send({ familyId: id, changeRequestId: pending, status: "pending" });
      }
      await tx(async (c) => {
        await c.query(
          `UPDATE families SET case_number=$2,family_surname=$3,head_name=$4,head_national_id=$5,head_birth_date=$6,head_phone=$7,family_phone=$8,head_education=$9,head_job=$10,insurance=$11,housing_type=$12,housing_deposit=$13,housing_rent=$14,address=$15,notes=$16,priority=$17,profile_data=profile_data || $18::jsonb,head_card_number=$19,updated_at=now() WHERE id=$1`,
          [
            id,
            f.caseNumber,
            f.familySurname,
            f.headName,
            f.headNationalId,
            f.headBirthDate,
            f.headPhone,
            f.familyPhone,
            jsonbValue(f.headEducation),
            f.headJob,
            f.insurance ?? {},
            f.housingType,
            f.housingDeposit,
            f.housingRent,
            f.address,
            f.notes,
            f.priority,
            f,
            f.headCardNumber,
          ],
        );
        await applySupervisor(c, req.actor!, id, f.supervisorId);
        // Editing an unrelated field (for example, the case number) must
        // never rebuild the members table from incidental form serialization.
        if (membersChanged) {
          await c.query("DELETE FROM family_members WHERE family_id=$1", [id]);
          for (const m of f.members)
            await c.query(
              "INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                id,
                m.name,
                m.relation,
                m.nationalId,
                m.birthDate,
                jsonbValue(m.education),
                m.job,
                m.monthlyIncome ?? 0,
              ],
            );
        }
        const before = current.rows[0],
          changedFields = [
            ["caseNumber", before.case_number, f.caseNumber],
            ["familySurname", before.family_surname, f.familySurname],
            ["headName", before.head_name, f.headName],
            ["headNationalId", before.head_national_id, f.headNationalId],
            ["headPhone", before.head_phone, f.headPhone],
            ["priority", before.priority, f.priority],
          ]
            .filter((x) => x[1] !== x[2])
            .map((x) => x[0]);
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.update','family',$2,$3)",
          [
            req.actor!.id,
            id,
            {
              caseNumber: f.caseNumber,
              changedFields,
              memberCount: f.members.length,
              membersUpdated: membersChanged,
            },
          ],
        );
      });
      return { familyId: id };
    },
  );

  app.put(
    "/families/:id/profile",
    { preHandler: allow("admin") },
    async (req, reply) => {
      const id = z
          .string()
          .uuid()
          .parse((req.params as { id: string }).id),
        f = family.parse(req.body),
        current = await pool.query(
          "SELECT case_number,archived FROM families WHERE id=$1",
          [id],
        );
      if (!current.rowCount)
        return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
      if (current.rows[0].archived)
        return reply.code(409).send({ error: "FAMILY_ARCHIVED" });
      if (current.rows[0].case_number !== f.caseNumber)
        return reply.code(409).send({ error: "PROFILE_CASE_MISMATCH" });
      await tx(async (c) => {
        await c.query(
          "UPDATE families SET profile_data=$2,updated_at=now() WHERE id=$1",
          [id, f],
        );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.profile.update','family',$2,$3)",
          [
            req.actor!.id,
            id,
            {
              caseNumber: f.caseNumber,
              source: "json",
              fieldCount: Object.keys(f).length,
            },
          ],
        );
      });
      return { familyId: id, profileUpdated: true };
    },
  );

  app.post(
    "/families/:id/archive",
    { preHandler: allow("admin", "caseworker") },
    async (req, reply) => {
      const id = z
        .string()
        .uuid()
        .parse((req.params as { id: string }).id);
      if (
        (!globalFamilyAccess(req.actor!) &&
          req.actor!.position !== "liaison") ||
        !(await canWorkFamily(req.actor!, id))
      )
        return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
      const body = z
          .object({ reason: z.string().trim().min(3).max(500) })
          .parse(req.body),
        current = await pool.query(
          "SELECT case_number,archived FROM families WHERE id=$1",
          [id],
        );
      if (!current.rowCount)
        return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
      if (current.rows[0].archived)
        return reply.code(409).send({ error: "ALREADY_ARCHIVED" });
      await tx(async (c) => {
        await c.query(
          "UPDATE families SET archived=true,updated_at=now() WHERE id=$1",
          [id],
        );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.archive','family',$2,$3)",
          [
            req.actor!.id,
            id,
            { caseNumber: current.rows[0].case_number, reason: body.reason },
          ],
        );
      });
      return { familyId: id, archived: true };
    },
  );

  app.post(
    "/families/:id/unarchive",
    { preHandler: allow("admin", "caseworker") },
    async (req, reply) => {
      const id = z
        .string()
        .uuid()
        .parse((req.params as { id: string }).id);
      if (
        (!globalFamilyAccess(req.actor!) &&
          req.actor!.position !== "liaison") ||
        !(await canWorkFamily(req.actor!, id))
      )
        return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
      const body = z
          .object({ reason: z.string().trim().min(3).max(500) })
          .parse(req.body),
        current = await pool.query(
          "SELECT case_number,archived FROM families WHERE id=$1",
          [id],
        );
      if (!current.rowCount)
        return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
      if (!current.rows[0].archived)
        return reply.code(409).send({ error: "NOT_ARCHIVED" });
      await tx(async (c) => {
        await c.query(
          "UPDATE families SET archived=false,updated_at=now() WHERE id=$1",
          [id],
        );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.unarchive','family',$2,$3)",
          [
            req.actor!.id,
            id,
            { caseNumber: current.rows[0].case_number, reason: body.reason },
          ],
        );
      });
      return { familyId: id, archived: false };
    },
  );

  app.post(
    "/families/import",
    { preHandler: allow("admin", "caseworker") },
    async (req, reply) => {
      if (!globalFamilyAccess(req.actor!) && req.actor!.position !== "liaison")
        return reply.code(403).send({ error: "FORBIDDEN" });
      const input = z
          .object({ families: z.array(family).min(1).max(100) })
          .parse(req.body),
        cases = input.families.map((f) => f.caseNumber),
        nids = input.families.flatMap((f) => [
          f.headNationalId,
          ...f.members.map((m) => m.nationalId),
        ]);
      if (
        new Set(cases).size !== cases.length ||
        new Set(nids).size !== nids.length
      )
        return reply.code(409).send({ error: "DUPLICATE_IN_FILE" });
      const ex = await pool.query(
        `SELECT 'caseNumber' type,case_number value FROM families WHERE case_number=ANY($1::text[]) UNION ALL SELECT 'nationalId',head_national_id FROM families WHERE head_national_id=ANY($2::text[]) UNION ALL SELECT 'nationalId',national_id FROM family_members WHERE national_id=ANY($2::text[])`,
        [cases, nids],
      );
      if (ex.rowCount)
        return reply
          .code(409)
          .send({ error: "DUPLICATE_VALUE", conflicts: ex.rows });
      const ids = await tx(async (c) => {
        const out: string[] = [];
        for (const f of input.families) {
          normalizeHousing(f);
          const q = await c.query(
            `INSERT INTO families(case_number,family_surname,head_name,head_national_id,head_birth_date,head_phone,family_phone,head_education,head_job,insurance,housing_type,housing_deposit,housing_rent,address,notes,priority,created_by,profile_data,approval_status,head_card_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
            [
              f.caseNumber,
              f.familySurname,
              f.headName,
              f.headNationalId,
              f.headBirthDate,
              f.headPhone,
              f.familyPhone,
              jsonbValue(f.headEducation),
              f.headJob,
              f.insurance ?? {},
              f.housingType,
              f.housingDeposit,
              f.housingRent,
              f.address,
              f.notes,
              f.priority,
              req.actor!.id,
              f,
              req.actor!.position === "liaison" ? "pending" : "approved",
              f.headCardNumber,
            ],
          );
          const id = q.rows[0].id as string;
          await applySupervisor(c, req.actor!, id, f.supervisorId);
          out.push(id);
          for (const m of f.members)
            await c.query(
              "INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                id,
                m.name,
                m.relation,
                m.nationalId,
                m.birthDate,
                jsonbValue(m.education),
                m.job,
                m.monthlyIncome ?? 0,
              ],
            );
          for (const n of f.notesHistory)
            await c.query(
              "INSERT INTO notes(family_id,body,status,institution_note,created_by) VALUES($1,$2,$3,$4,$5)",
              [id, n.text, n.status, n.institutionNote, req.actor!.id],
            );
          await c.query(
            "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.import','family',$2,$3)",
            [
              req.actor!.id,
              id,
              { caseNumber: f.caseNumber, memberCount: f.members.length },
            ],
          );
        }
        return out;
      });
      return reply.code(201).send({ imported: ids.length, ids });
    },
  );
}
export function normalizeHousing(f: Record<string, any>) {
  if (["ملکی", "owned", "owner"].includes(f.housingType)) {
    f.housingDeposit = 0;
    f.housingRent = 0;
    f.housing = { ...(f.housing ?? {}), deposit: 0, rent: 0 };
  }
}

export const familyInput = family;
