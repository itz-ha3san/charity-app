import { tx } from '../db.js';
import type { Actor } from '../auth.js';
import { globalFamilyAccess } from '../scope.js';
import { familyInput, normalizeHousing } from '../domain/familyInput.js';
import { familyEditField, type ReviewInput } from '../domain/approval.js';
import { reviewStatus } from '../domain/financial.js';
import { DomainError } from '../domain/errors.js';
import { applySupervisor } from '../supervisors.js';
import { recordAudit } from '../audit.js';
import { z } from 'zod';
export async function reviewNewFamily(actor: Actor, id: string, b: ReviewInput) {
    if (!globalFamilyAccess(actor))
        throw new DomainError(403, 'FORBIDDEN');
    return tx(async (c) => {
        const q = await c.query("SELECT case_number,approval_status,archived FROM families WHERE id=$1 FOR UPDATE", [id]);
        if (!q.rowCount)
            throw new DomainError(404, "FAMILY_NOT_FOUND");
        if (q.rows[0].archived)
            throw new DomainError(409, "FAMILY_ARCHIVED");
        if (q.rows[0].approval_status !== "pending")
            throw new DomainError(409, "FAMILY_NOT_PENDING");
        const status = reviewStatus(b.decision);
        await c.query("UPDATE families SET approval_status=$2,approval_note=$3,approved_by=$4,approved_at=now(),updated_at=now() WHERE id=$1", [id, status, b.note, actor.id]);
        await recordAudit(c, { actorId: actor.id, action: 'family.creation.review', entityType: 'family', entityId: id, details: { caseNumber: q.rows[0].case_number, status, note: b.note } });
        return { familyId: id, status };
    });
}
export async function reviewFamilyChange(actor: Actor, id: string, b: ReviewInput) {
    if (!globalFamilyAccess(actor))
        throw new DomainError(403, 'FORBIDDEN');
    return tx(async (c) => {
        const q = await c.query(`SELECT c.*,f.case_number,f.archived FROM family_change_requests c JOIN families f ON f.id=c.family_id WHERE c.id=$1 FOR UPDATE OF c,f`, [id]);
        if (!q.rowCount)
            throw new DomainError(404, "CHANGE_REQUEST_NOT_FOUND");
        const x = q.rows[0];
        if (x.status !== "pending")
            throw new DomainError(409, "CHANGE_REQUEST_NOT_PENDING");
        if (x.archived)
            throw new DomainError(409, "FAMILY_ARCHIVED");
        const requestData = x.proposed_data as Record<string, unknown>;
        const isScopedPatch = requestData?.version === 3 &&
            requestData.snapshot &&
            typeof requestData.snapshot === "object" &&
            !Array.isArray(requestData.snapshot);
        if (b.decision === "approve" && !isScopedPatch)
            throw new DomainError(409, "LEGACY_CHANGE_REQUEST_REQUIRES_RESUBMISSION");
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
            if (patchKeys.length !== approvedKeys.length ||
                patchKeys.some((key, index) => key !== approvedKeys[index]))
                throw new DomainError(409, "INVALID_CHANGE_REQUEST");
        }
        const status = reviewStatus(b.decision);
        if (status === "approved") {
            const f = familyInput
                .omit({ notesHistory: true })
                .parse(isScopedPatch ? requestData.snapshot : x.proposed_data);
            if (!isScopedPatch)
                normalizeHousing(f);
            const columns: Record<string, {
                name: string;
                jsonb?: boolean;
            }> = {
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
                if (!column)
                    continue;
                const value = proposedPatch[key];
                values.push(column.jsonb ? JSON.stringify(value ?? {}) : value);
                assignments.push(`${column.name}=$${values.length}${column.jsonb ? "::jsonb" : ""}`);
            }
            if (changedFields.includes("supervisorId"))
                await applySupervisor(c, actor, x.family_id, f.supervisorId);
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
                    await c.query("INSERT INTO family_members(family_id,name,relation,national_id,birth_date,education,job,monthly_income)VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [
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
                    ]);
            }
            const profilePatch = Object.fromEntries(changedFields
                .filter((key) => key !== "supervisorId")
                .map((key) => [key, proposedPatch[key]]));
            if (Object.keys(profilePatch).length) {
                values.push(JSON.stringify(profilePatch));
                assignments.push(`profile_data=profile_data||$${values.length}::jsonb`);
            }
            assignments.push("updated_at=now()");
            await c.query(`UPDATE families SET ${assignments.join(",")} WHERE id=$1`, values);
        }
        await c.query("UPDATE family_change_requests SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() WHERE id=$1", [id, status, b.note, actor.id]);
        await recordAudit(c, { actorId: actor.id, action: 'family.change.review', entityType: 'family', entityId: x.family_id, details: { caseNumber: x.case_number, changeRequestId: id, status, note: b.note, changedFields: status === 'approved' ? changedFields : [] } });
        return { changeRequestId: id, status };
    });
}
