import { reviewInput } from '../domain/approval.js';
import { reviewNewFamily, reviewFamilyChange } from '../services/approvals.js';
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";
import { globalFamilyAccess } from "../scope.js";
const uuid = z.string().uuid();
const canApprove = globalFamilyAccess;
export async function registerApprovalRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);
    app.get("/approvals/families", async (req, reply) => {
        if (!canApprove(req.actor!))
            return reply.code(403).send({ error: "FORBIDDEN" });
        const [created, changes] = await Promise.all([
            pool.query(`SELECT f.id,f.case_number "caseNumber",f.head_name "headName",f.created_at "createdAt",u.display_name "requestedBy" FROM families f LEFT JOIN users u ON u.id=f.created_by WHERE f.approval_status='pending' ORDER BY f.created_at`),
            pool.query(`SELECT c.id,c.family_id "familyId",f.case_number "caseNumber",f.head_name "headName",
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
          WHERE c.status='pending' ORDER BY c.created_at`),
        ]);
        return { newFamilies: created.rows, changes: changes.rows };
    });
    app.post("/families/:id/review", async (req) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id), body = reviewInput.parse(req.body);
        return reviewNewFamily(req.actor!, id, body);
    });
    app.post("/family-change-requests/:id/review", async (req) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id), body = reviewInput.parse(req.body);
        return reviewFamilyChange(req.actor!, id, body);
    });
}
