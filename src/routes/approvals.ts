import { familyInput, normalizeHousing } from "./families.js";
import { applySupervisor } from "../supervisors.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool, tx } from "../db.js";
import { requireAuth } from "../auth.js";
const uuid = z.string().uuid();
const familyEditFields = [
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
  "supervisorId",
  "housingType",
  "housingDeposit",
  "housingRent",
  "housing",
  "address",
  "notes",
  "priority",
  "members",
] as const;
const familyEditField = z.enum(familyEditFields);
const canApprove = (a: { role: string; position: string }) =>
  a.role === "admin" ||
  ["ceo", "education_deputy", "health_deputy", "supervision_deputy"].includes(
    a.position,
  );
export async function registerApprovalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/approvals/families", async (req, reply) => {
    if (!canApprove(req.actor!))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const [created, changes] = await Promise.all([
      pool.query(
        `SELECT f.id,f.case_number "caseNumber",f.head_name "headName",f.created_at "createdAt",u.display_name "requestedBy" FROM families f LEFT JOIN users u ON u.id=f.created_by WHERE f.approval_status='pending' ORDER BY f.created_at`,
      ),
      pool.query(
        `SELECT c.id,c.family_id "familyId",f.case_number "caseNumber",f.head_name "headName",
          COALESCE(c.proposed_data->'snapshot',c.proposed_data) "proposedData",
          c.proposed_data->'patch' "proposedPatch",
          c.proposed_data->'changedFields' "changedFields",
          c.proposed_data->'version' "proposalVersion",
          COALESCE(f.profile_data,'{}'::jsonb) || jsonb_build_object(
            'caseNumber',f.case_number,
            'familySurname',f.family_surname,
            'headName',f.head_name,
            'headNationalId',f.head_national_id,
            'headBirthDate',f.head_birth_date,
            'headPhone',f.head_phone,
            'familyPhone',f.family_phone,
            'headEducation',f.head_education,
            'headJob',f.head_job,
            'headCardNumber',f.head_card_number,
            'insurance',COALESCE(f.insurance,'{}'::jsonb),
            'housingType',f.housing_type,
            'housingDeposit',f.housing_deposit,
            'housingRent',f.housing_rent,
            'address',f.address,
            'notes',f.notes,
            'priority',f.priority,
            'supervisorId',(SELECT fa.supervisor_id FROM family_supervisor_assignments fa WHERE fa.family_id=f.id AND fa.ends_at IS NULL LIMIT 1),
            'housing',COALESCE(f.profile_data->'housing','{}'::jsonb) || jsonb_build_object(
              'type',f.housing_type,'deposit',f.housing_deposit,'rent',f.housing_rent,'address',f.address
            ),
            'members',COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'name',m.name,'relation',m.relation,'nationalId',m.national_id,
                'birthDate',m.birth_date,'education',m.education,'job',m.job,'monthlyIncome',m.monthly_income
              ) ORDER BY m.created_at,m.name)
              FROM family_members m WHERE m.family_id=f.id
            ),'[]'::jsonb)
          ) "currentData",
          current_supervisor.name "currentSupervisorName",
          proposed_supervisor.name "proposedSupervisorName",
          c.created_at "createdAt",u.display_name "requestedBy"
          FROM family_change_requests c
          JOIN families f ON f.id=c.family_id
          LEFT JOIN users u ON u.id=c.requested_by
          LEFT JOIN LATERAL (
            SELECT s.name FROM family_supervisor_assignments fa
            JOIN supervisors s ON s.id=fa.supervisor_id
            WHERE fa.family_id=f.id AND fa.ends_at IS NULL LIMIT 1
          ) current_supervisor ON true
          LEFT JOIN supervisors proposed_supervisor
            ON proposed_supervisor.id=NULLIF(COALESCE(c.proposed_data->'snapshot',c.proposed_data)->>'supervisorId','')::uuid
          WHERE c.status='pending' ORDER BY c.created_at`,
      ),
    ]);
    return { newFamilies: created.rows, changes: changes.rows };
  });
  app.post("/families/:id/review", async (req, reply) => {
    if (!canApprove(req.actor!))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const id = uuid.parse((req.params as { id: string }).id),
      b = z
        .object({
          decision: z.enum(["approve", "reject", "cancel"]),
          note: z.string().trim().min(3).max(1000),
        })
        .parse(req.body),
      q = await pool.query(
        "SELECT case_number,approval_status FROM families WHERE id=$1",
        [id],
      );
    if (!q.rowCount) return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
    if (q.rows[0].approval_status !== "pending")
      return reply.code(409).send({ error: "FAMILY_NOT_PENDING" });
    const status =
      b.decision === "approve"
        ? "approved"
        : b.decision === "reject"
          ? "rejected"
          : "cancelled";
    await tx(async (c) => {
      await c.query(
        "UPDATE families SET approval_status=$2,approval_note=$3,approved_by=$4,approved_at=now(),updated_at=now() WHERE id=$1",
        [id, status, b.note, req.actor!.id],
      );
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'family.creation.review','family',$2,$3)",
        [
          req.actor!.id,
          id,
          { caseNumber: q.rows[0].case_number, status, note: b.note },
        ],
      );
    });
    return { familyId: id, status };
  });
  app.post("/family-change-requests/:id/review", async (req, reply) => {
    if (!canApprove(req.actor!))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const id = uuid.parse((req.params as { id: string }).id),
      b = z
        .object({
          decision: z.enum(["approve", "reject", "cancel"]),
          note: z.string().trim().min(3).max(1000),
        })
        .parse(req.body),
      q = await pool.query(
        `SELECT c.*,f.case_number,f.archived FROM family_change_requests c JOIN families f ON f.id=c.family_id WHERE c.id=$1`,
        [id],
      );
    if (!q.rowCount)
      return reply.code(404).send({ error: "CHANGE_REQUEST_NOT_FOUND" });
    const x = q.rows[0];
    if (x.status !== "pending")
      return reply.code(409).send({ error: "CHANGE_REQUEST_NOT_PENDING" });
    if (x.archived) return reply.code(409).send({ error: "FAMILY_ARCHIVED" });
    const requestData = x.proposed_data as Record<string, unknown>;
    const isScopedPatch =
      requestData?.version === 3 &&
      requestData.snapshot &&
      typeof requestData.snapshot === "object" &&
      !Array.isArray(requestData.snapshot);
    if (b.decision === "approve" && !isScopedPatch)
      return reply
        .code(409)
        .send({ error: "LEGACY_CHANGE_REQUEST_REQUIRES_RESUBMISSION" });
    let proposedPatch: Record<string, unknown> = {};
    let changedFields: string[] = [];
    if (isScopedPatch) {
      proposedPatch = z.record(z.unknown()).parse(requestData.patch);
      changedFields = z
        .array(familyEditField)
        .min(1)
        .parse(requestData.changedFields);
      const patchKeys = Object.keys(proposedPatch).sort();
      const approvedKeys = [...changedFields].sort();
      if (
        patchKeys.length !== approvedKeys.length ||
        patchKeys.some((key, index) => key !== approvedKeys[index])
      )
        return reply.code(409).send({ error: "INVALID_CHANGE_REQUEST" });
    }
    const status =
      b.decision === "approve"
        ? "approved"
        : b.decision === "reject"
          ? "rejected"
          : "cancelled";
    await tx(async (c) => {
      if (status === "approved") {
        const f = familyInput
          .omit({ notesHistory: true })
          .parse(isScopedPatch ? requestData.snapshot : x.proposed_data);
        if (!isScopedPatch) normalizeHousing(f);

        const columns: Record<string, { name: string; jsonb?: boolean }> = {
          caseNumber: { name: "case_number" },
          familySurname: { name: "family_surname" },
          headName: { name: "head_name" },
          headNationalId: { name: "head_national_id" },
          headBirthDate: { name: "head_birth_date" },
          headPhone: { name: "head_phone" },
          headCardNumber: { name: "head_card_number" },
          familyPhone: { name: "family_phone" },
          headEducation: { name: "head_education", jsonb: true },
          headJob: { name: "head_job" },
          insurance: { name: "insurance", jsonb: true },
          housingType: { name: "housing_type" },
          housingDeposit: { name: "housing_deposit" },
          housingRent: { name: "housing_rent" },
          address: { name: "address" },
          notes: { name: "notes" },
          priority: { name: "priority" },
        };
        const assignments: string[] = [];
        const values: unknown[] = [x.family_id];
        for (const key of changedFields) {
          const column = columns[key];
          if (!column) continue;
          const value = proposedPatch[key];
          values.push(
            column.jsonb ? JSON.stringify(value ?? {}) : value,
          );
          assignments.push(
            `${column.name}=$${values.length}${column.jsonb ? "::jsonb" : ""}`,
          );
        }
        if (changedFields.includes("supervisorId"))
          await applySupervisor(c, req.actor!, x.family_id, f.supervisorId);
        if (changedFields.includes("members")) {
          const proposedMembers = familyInput
            .omit({ notesHistory: true })
            .parse({
              ...f,
              members: proposedPatch.members,
            }).members;
          await c.query("DELETE FROM family_members WHERE family_id=$1", [
            x.family_id,
          ]);
          for (const m of proposedMembers ?? [])
            await c.query(
              "INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income)VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                x.family_id,
                m.name,
                m.relation,
                m.nationalId,
                m.birthDate,
                typeof m.education === "string"
                  ? JSON.stringify(m.education)
                  : JSON.stringify(m.education ?? {}),
                m.job,
                m.monthlyIncome ?? 0,
              ],
            );
        }
        const profilePatch = Object.fromEntries(
          changedFields
            .filter((key) => key !== "supervisorId")
            .map((key) => [key, proposedPatch[key]]),
        );
        if (Object.keys(profilePatch).length) {
          values.push(JSON.stringify(profilePatch));
          assignments.push(`profile_data=profile_data||$${values.length}::jsonb`);
        }
        assignments.push("updated_at=now()");
        await c.query(
          `UPDATE families SET ${assignments.join(",")} WHERE id=$1`,
          values,
        );
      }
      await c.query(
        "UPDATE family_change_requests SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() WHERE id=$1",
        [id, status, b.note, req.actor!.id],
      );
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)VALUES($1,'family.change.review','family',$2,$3)",
        [
          req.actor!.id,
          x.family_id,
          {
            caseNumber: x.case_number,
            changeRequestId: id,
            status,
            note: b.note,
            changedFields: status === "approved" ? changedFields : [],
          },
        ],
      );
    });
    return { changeRequestId: id, status };
  });
}
