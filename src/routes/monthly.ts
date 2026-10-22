import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { requireAuth, type Actor } from '../auth.js';
import { pool, tx } from '../db.js';
import { familyViewScope } from '../scope.js';
import { DomainError } from '../domain/errors.js';
import { jalaliPeriod, shiftPeriod } from '../domain/financialAnalytics.js';
import { monthlyAmount, monthlyRevision, monthlySnapshot, type MonthlyFamily } from '../domain/monthly.js';
import { log } from '../repositories/financial.js';
const manage = (a: Actor) => a.role === 'admin' || ['ceo', 'supervision_deputy'].includes(a.position);
const period = z.object({ liaisonId: z.string().uuid(), jalaliYear: z.coerce.number().int().min(1300).max(1600), jalaliMonth: z.coerce.number().int().min(1).max(12) }).strict();
const command = period.extend({ revision: z.string().regex(/^[a-f0-9]{64}$/), selectedIds: z.array(z.string().uuid()).max(10000), submit: z.boolean().default(false) });
type Period = z.infer<typeof period>;
async function target(c: PoolClient, a: Actor, p: Period) {
    if (!manage(a) && !(a.position === 'liaison' && a.id === p.liaisonId))
        throw new DomainError(403, 'FORBIDDEN');
    const next = shiftPeriod(jalaliPeriod(), 1);
    if (p.jalaliYear * 12 + p.jalaliMonth > next.year * 12 + next.month)
        throw new DomainError(400, 'MONTHLY_PERIOD_INVALID');
    const r = await c.query("SELECT id,display_name FROM users WHERE id=$1 AND active AND position='liaison'", [p.liaisonId]);
    if (!r.rowCount)
        throw new DomainError(403, 'INVALID_LIAISON');
    return r.rows[0] as {
        id: string;
        display_name: string;
    };
}
async function loadFamilies(c: PoolClient, p: Period, locking = false): Promise<MonthlyFamily[]> {
    const liaison: Actor = { id: p.liaisonId, name: '', role: 'caseworker', position: 'liaison', mustChangePassword: false };
    const scope = familyViewScope(liaison, 'f');
    // Lock in stable order before inspecting amounts, assignment and duplicate period claims.
    const rows = await c.query(`SELECT f.id,f.case_number,f.family_surname,f.head_name,f.profile_data FROM families f WHERE NOT f.archived AND (${scope.sql}) ORDER BY f.id ${locking ? 'FOR UPDATE OF f' : ''}`, scope.params);
    const ids = rows.rows.map(r => r.id);
    if (!ids.length)
        return [];
    const supervisors = await c.query(`SELECT fa.family_id,s.id,s.name FROM family_supervisor_assignments fa JOIN supervisors s ON s.id=fa.supervisor_id AND s.active WHERE fa.ends_at IS NULL AND fa.family_id=ANY($1::uuid[]) ORDER BY fa.family_id`, [ids]);
    const aids = await c.query(`SELECT fc.id,fc.family_id,fc.title,fc.category,COALESCE(fc.approved_amount,fc.amount)::text amount FROM financial_cases fc WHERE fc.family_id=ANY($1::uuid[]) AND fc.request_type='ad_hoc' AND fc.status IN ('تأیید شده','ارجاع به حسابدار') AND NOT EXISTS(SELECT 1 FROM financial_payments fp WHERE fp.financial_case_id=fc.id) AND NOT EXISTS(SELECT 1 FROM monthly_request_aids ma WHERE ma.financial_case_id=fc.id) ORDER BY fc.id ${locking ? 'FOR UPDATE OF fc' : ''}`, [ids]);
    const conflicts = await c.query(`SELECT DISTINCT f.id FROM families f WHERE f.id=ANY($1::uuid[]) AND (EXISTS(SELECT 1 FROM monthly_request_families mf WHERE mf.family_id=f.id AND mf.jalali_year=$2 AND mf.jalali_month=$3) OR EXISTS(SELECT 1 FROM financial_cases fc WHERE fc.family_id=f.id AND fc.request_type='monthly' AND fc.jalali_year=$2 AND fc.jalali_month=$3 AND fc.status NOT IN ('رد شده','لغو شده')))`, [ids, p.jalaliYear, p.jalaliMonth]);
    const dup = new Set(conflicts.rows.map(r => r.id));
    return rows.rows.map(f => { const su = supervisors.rows.find(s => s.family_id === f.id); return { id: f.id, caseNumber: f.case_number, familyName: f.family_surname || f.head_name, supervisorId: su?.id ?? null, supervisorName: su?.name ?? 'بدون سرپرست تعیین‌شده', baseAmount: monthlyAmount(f.profile_data?.monthlyAid), conflict: dup.has(f.id), aids: aids.rows.filter(a => a.family_id === f.id).map(a => ({ id: a.id, familyId: f.id, title: a.title, category: a.category ?? 'سایر', amount: a.amount })) }; });
}
export async function registerMonthlyRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireAuth);
    app.get('/monthly-requests/liaisons', async (req) => {
        if (!manage(req.actor!) && req.actor!.position !== 'liaison')
            throw new DomainError(403, 'FORBIDDEN');
        const r = await pool.query(`SELECT id,display_name name FROM users WHERE active AND position='liaison' ${manage(req.actor!) ? '' : 'AND id=$1'} ORDER BY display_name`, manage(req.actor!) ? [] : [req.actor!.id]);
        return { liaisons: r.rows };
    });
    app.get('/monthly-requests', async (req) => {
        const p = period.parse(req.query);
        return tx(async (c) => {
            await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            const liaison = await target(c, req.actor!, p), families = await loadFamilies(c, p);
            const draft = await c.query('SELECT id,status,selected_ids,snapshot FROM monthly_requests WHERE liaison_id=$1 AND jalali_year=$2 AND jalali_month=$3', [p.liaisonId, p.jalaliYear, p.jalaliMonth]);
            const saved = draft.rows[0];
            if (saved?.status === 'submitted') {
                const scoped = new Set(families.map(f => f.id));
                if (saved.snapshot.groups.some((g: {
                    families: {
                        id: string;
                    }[];
                }) => g.families.some(f => !scoped.has(f.id))))
                    throw new DomainError(403, 'FAMILY_SCOPE_FORBIDDEN');
                return { ...p, liaisonName: liaison.display_name, requestId: saved.id, status: 'submitted', snapshot: saved.snapshot, selectedIds: saved.selected_ids, revision: monthlyRevision(families) };
            }
            const available = new Set(families.flatMap(f => f.aids.map(a => a.id))), selected = (saved?.selected_ids ?? []).filter((id: string) => available.has(id));
            return { ...p, liaisonName: liaison.display_name, status: 'draft', requestId: saved?.id ?? null, selectedIds: selected, revision: monthlyRevision(families), draftChanged: Boolean(saved && selected.length !== saved.selected_ids.length), snapshot: monthlySnapshot(families, selected) };
        });
    });
    app.post('/monthly-requests', async (req, reply) => {
        const b = command.parse(req.body);
        const result = await tx(async (c) => {
            const liaison = await target(c, req.actor!, b);
            await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`monthly:${b.liaisonId}:${b.jalaliYear}:${b.jalaliMonth}`]);
            const prior = await c.query('SELECT id,status FROM monthly_requests WHERE liaison_id=$1 AND jalali_year=$2 AND jalali_month=$3 FOR UPDATE', [b.liaisonId, b.jalaliYear, b.jalaliMonth]);
            if (prior.rows[0]?.status === 'submitted') {
                if (b.submit)
                    return { requestId: prior.rows[0].id, status: 'submitted', replayed: true };
                throw new DomainError(409, 'MONTHLY_ALREADY_SUBMITTED');
            }
            const families = await loadFamilies(c, b, true);
            if (monthlyRevision(families) !== b.revision)
                throw new DomainError(409, 'MONTHLY_DATA_CHANGED');
            const snapshot = monthlySnapshot(families, b.selectedIds);
            if (!families.length)
                throw new DomainError(409, 'MONTHLY_NO_FAMILIES');
            if (b.submit && (snapshot.missingAmounts.length || snapshot.conflictingFamilies.length))
                throw new DomainError(409, 'MONTHLY_INCOMPLETE', { missingAmounts: snapshot.missingAmounts, conflictingFamilies: snapshot.conflictingFamilies });
            const saved = await c.query(`INSERT INTO monthly_requests(liaison_id,created_by,jalali_year,jalali_month,status,selected_ids,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT(liaison_id,jalali_year,jalali_month) DO UPDATE SET status=EXCLUDED.status,selected_ids=EXCLUDED.selected_ids,snapshot=EXCLUDED.snapshot,updated_at=now() RETURNING id`, [b.liaisonId, req.actor!.id, b.jalaliYear, b.jalaliMonth, b.submit ? 'submitted' : 'draft', JSON.stringify(b.selectedIds), JSON.stringify(snapshot)]);
            const id = saved.rows[0].id;
            if (b.submit)
                for (const group of snapshot.groups)
                    for (const f of group.families) {
                        let caseId: string | null = null;
                        if (BigInt(f.baseAmount ?? '0') > 0n) {
                            const r = await c.query(`INSERT INTO financial_cases(family_id,title,category,request_type,status,amount,jalali_year,jalali_month,description,created_by,required_approver_position) VALUES($1,$2,'کمک نقدی','monthly','در بررسی',$3,$4,$5,$6,$7,'supervision_deputy') RETURNING id`, [f.id, `ماهیانه ${b.jalaliYear}/${b.jalaliMonth} · ${f.familyName}`.slice(0, 150), f.baseAmount, b.jalaliYear, b.jalaliMonth, `سرپرست: ${f.supervisorName} · رابط: ${liaison.display_name} · صورت‌حساب ${id}`, req.actor!.id]);
                            caseId = r.rows[0].id;
                            await c.query(`INSERT INTO financial_case_events(financial_case_id,family_id,actor_id,action,to_status,note,amount) VALUES($1,$2,$3,'create','در بررسی',$4,$5)`, [caseId, f.id, req.actor!.id, `ثبت از فهرست ماهیانه ${id}`, f.baseAmount]);
                        }
                        await c.query('INSERT INTO monthly_request_families(request_id,family_id,jalali_year,jalali_month,financial_case_id)VALUES($1,$2,$3,$4,$5)', [id, f.id, b.jalaliYear, b.jalaliMonth, caseId]);
                        for (const aid of f.extras)
                            await c.query('INSERT INTO monthly_request_aids(request_id,family_id,financial_case_id)VALUES($1,$2,$3)', [id, f.id, aid.id]);
                        await log(c, req.actor!.id, f.id, 'monthly.submit', { requestId: id, financialCaseId: caseId, jalaliYear: b.jalaliYear, jalaliMonth: b.jalaliMonth, baseAmount: f.baseAmount, extraIds: f.extras.map(a => a.id) });
                    }
            return { requestId: id, status: b.submit ? 'submitted' : 'draft', replayed: false };
        });
        return reply.code(result.replayed ? 200 : 201).send(result);
    });
}
