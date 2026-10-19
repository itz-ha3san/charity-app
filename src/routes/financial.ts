import { financialStatuses as statuses } from '../domain/financial.js';
import { lockedCase, log, lockFundPeriod } from '../repositories/financial.js';
import { transitionFinancialCase, payFinancialCase, type FinancialFailure } from '../services/financial.js';
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash } from "node:crypto";
import { pool, tx } from "../db.js";
import { allow, requireAuth } from "../auth.js";
import { canViewFamily, canWorkFamily } from "../scope.js";
import { accessReason, inspectFile, recordSensitiveAccess, securityEvent } from "../security.js";
const categories = ["لوازم آموزشی", "بهداشت و درمان", "بیمه", "کلاس آموزشی", "خرید لوازم منزل", "معیشت", "قسط", "اهدایی", "مسکن", "درمان", "تحصیل", "خوراک", "اشتغال", "کمک نقدی", "سایر"] as const, uuid = z.string().uuid(), period = z.object({ jalaliYear: z.coerce.number().int().min(1300), jalaliMonth: z.coerce.number().int().min(1).max(12) });
const input = z.object({ title: z.string().trim().min(2).max(150), category: z.enum(categories), requestType: z.enum(["ad_hoc", "monthly"]).default("ad_hoc"), amount: z.coerce.number().int().positive().max(9000000000000), jalaliYear: z.coerce.number().int().min(1300).nullable().optional(), jalaliMonth: z.coerce.number().int().min(1).max(12).nullable().optional(), institutionNote: z.string().max(1000).default(""), description: z.string().max(3000).default("") });
const receipt = z.object({ fileName: z.string().trim().min(1).max(240), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), contentBase64: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).nullable().optional();
export async function registerFinancialRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);
    app.get("/funds", async (req) => { const q = period.partial().parse(req.query), p: unknown[] = [], joins = q.jalaliYear && q.jalaliMonth ? (p.push(q.jalaliYear, q.jalaliMonth), `LEFT JOIN fund_budgets b ON b.fund_id=f.id AND b.jalali_year=$1 AND b.jalali_month=$2 LEFT JOIN financial_payments x ON x.fund_id=f.id AND x.jalali_year=$1 AND x.jalali_month=$2`) : "LEFT JOIN fund_budgets b ON false LEFT JOIN financial_payments x ON false", r = await pool.query(`SELECT f.id,f.name,f.description,f.active,COALESCE(MAX(b.amount),0)::text budget,COALESCE(SUM(x.amount),0)::text spent,(COALESCE(MAX(b.amount),0)-COALESCE(SUM(x.amount),0))::text remaining FROM funds f ${joins} GROUP BY f.id ORDER BY f.active DESC,f.name`, p); return { funds: r.rows, period: q }; });
    app.post("/funds", { preHandler: allow("admin") }, async (req, reply) => { const b = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(1000).default("") }).parse(req.body), r = await pool.query("INSERT INTO funds(name,description,created_by) VALUES($1,$2,$3) RETURNING id", [b.name, b.description, req.actor!.id]); return reply.code(201).send({ fundId: r.rows[0].id }); });
    app.patch("/funds/:id", { preHandler: allow("admin") }, async (req) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id), b = z.object({ active: z.boolean() }).parse(req.body);
        await pool.query("UPDATE funds SET active=$2,updated_at=now() WHERE id=$1", [id, b.active]);
        return { fundId: id };
    });
    app.put("/funds/:id/budget", { preHandler: allow("admin") }, async (req) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id), b = period.extend({ amount: z.coerce.number().int().min(0).max(9000000000000) }).parse(req.body);
        await tx(async (c) => { await lockFundPeriod(c, id, b.jalaliYear, b.jalaliMonth); await c.query(`INSERT INTO fund_budgets(fund_id,jalali_year,jalali_month,amount,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(fund_id,jalali_year,jalali_month) DO UPDATE SET amount=EXCLUDED.amount,updated_at=now()`, [id, b.jalaliYear, b.jalaliMonth, b.amount, req.actor!.id]); });
        return { fundId: id, ...b };
    });
    app.get("/families/:id/financial-cases", async (req, reply) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id);
        if (!await canViewFamily(req.actor!, id))
            return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
        const f = await pool.query("SELECT archived FROM families WHERE id=$1", [id]);
        if (!f.rowCount)
            return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
        const r = await pool.query(`SELECT fc.id,fc.title,fc.category,fc.status,fc.request_type "requestType",fc.source_type "sourceType",fc.required_approver_position "requiredApproverPosition",fc.amount::text amount,fc.approved_amount::text "approvedAmount",fc.decision_note "decisionNote",fc.jalali_year "jalaliYear",fc.jalali_month "jalaliMonth",fc.institution_note "institutionNote",fc.description,fc.rejection_reason "rejectionReason",fc.created_by "createdBy",fc.created_at "createdAt",p.id "paymentId",p.amount::text "paidAmount",p.paid_at "paidAt",p.reference_no "referenceNo",p.receipt_file_name "receiptFileName",fu.name "fundName",fdocs.documents "documents" FROM financial_cases fc LEFT JOIN financial_payments p ON p.financial_case_id=fc.id LEFT JOIN funds fu ON fu.id=p.fund_id LEFT JOIN LATERAL (SELECT COALESCE(json_agg(json_build_object('id',d.id,'documentType',d.document_type,'fileName',d.file_name,'mimeType',d.mime_type,'description',d.description,'sizeBytes',d.size_bytes,'createdAt',d.created_at) ORDER BY d.created_at DESC),'[]'::json) AS documents FROM financial_case_documents d WHERE d.financial_case_id=fc.id) fdocs ON true WHERE fc.family_id=$1 ORDER BY fc.created_at DESC`, [id]);
        const events = await pool.query(`SELECT e.id,e.financial_case_id "financialCaseId",e.action,e.from_status "fromStatus",e.to_status "toStatus",e.note,e.amount::text amount,e.created_at "createdAt",u.display_name "actorName" FROM financial_case_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.family_id=$1 ORDER BY e.created_at DESC`, [id]);
        return { financialCases: r.rows, history: events.rows, totalAmount: r.rows.reduce((n, x) => n + BigInt(x.amount), 0n).toString(), paidAmount: r.rows.reduce((n, x) => n + BigInt(x.paidAmount || "0"), 0n).toString(), archived: f.rows[0].archived, statuses };
    });
    app.post("/families/:id/financial-cases", { preHandler: allow("admin", "caseworker") }, async (req, reply) => {
        const familyId = uuid.parse((req.params as {
            id: string;
        }).id);
        if (!await canWorkFamily(req.actor!, familyId))
            return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
        const b = input.parse(req.body), f = await pool.query("SELECT case_number,archived FROM families WHERE id=$1", [familyId]);
        if (!f.rowCount)
            return reply.code(404).send({ error: "FAMILY_NOT_FOUND" });
        if (f.rows[0].archived)
            return reply.code(409).send({ error: "FAMILY_ARCHIVED" });
        const id = await tx(async (c) => { const r = await c.query(`INSERT INTO financial_cases(family_id,title,category,request_type,status,amount,jalali_year,jalali_month,institution_note,description,created_by) VALUES($1,$2,$3,$4,'درخواست جدید',$5,$6,$7,$8,$9,$10) RETURNING id`, [familyId, b.title, b.category, b.requestType, b.amount, b.jalaliYear ?? null, b.jalaliMonth ?? null, b.institutionNote, b.description, req.actor!.id]); await c.query("INSERT INTO financial_case_events(financial_case_id,family_id,actor_id,action,to_status,note,amount) VALUES($1,$2,$3,'create','درخواست جدید',$4,$5)", [r.rows[0].id, familyId, req.actor!.id, b.description, b.amount]); await log(c, req.actor!.id, familyId, "financial.create", { caseNumber: f.rows[0].case_number, financialCaseId: r.rows[0].id, title: b.title, amount: b.amount, status: "درخواست جدید" }); return r.rows[0].id; });
        return reply.code(201).send({ financialCaseId: id });
    });
    app.patch("/financial-cases/:caseId", { preHandler: allow("admin", "caseworker") }, async (req, reply) => {
        const id = uuid.parse((req.params as {
            caseId: string;
        }).caseId), b = input.parse(req.body);
        const result = await tx<FinancialFailure | {
            financialCaseId: string;
        }>(async (c) => {
            const r = await lockedCase(c, id);
            if (!r.rowCount)
                return { error: "FINANCIAL_CASE_NOT_FOUND", code: 404 };
            const x = r.rows[0];
            if (!await canWorkFamily(req.actor!, x.family_id))
                return { error: "FAMILY_SCOPE_FORBIDDEN", code: 403 };
            if (x.archived)
                return { error: "FAMILY_ARCHIVED", code: 409 };
            if (!["درخواست جدید", "در بررسی"].includes(x.status))
                return { error: "FINANCIAL_CASE_LOCKED", code: 409 };
            await c.query("UPDATE financial_cases SET title=$2,category=$3,request_type=$4,amount=$5,jalali_year=$6,jalali_month=$7,institution_note=$8,description=$9,updated_at=now() WHERE id=$1", [id, b.title, b.category, b.requestType, b.amount, b.jalaliYear ?? null, b.jalaliMonth ?? null, b.institutionNote, b.description]);
            await log(c, req.actor!.id, x.family_id, "financial.update", { caseNumber: x.case_number, financialCaseId: id, title: b.title, amount: b.amount, status: x.status });
            return { financialCaseId: id };
        });
        if ("error" in result) {
            const { code, ...body } = result;
            return reply.code(code).send(body);
        }
        return result;
    });
    app.post("/financial-cases/:caseId/transition", async (req, reply) => {
        const id = uuid.parse((req.params as {
            caseId: string;
        }).caseId);
        const body = z.object({ action: z.enum(["review", "approve", "reject", "refer", "queue_payment", "cancel"]), reason: z.string().trim().max(1000).optional(), approvedAmount: z.coerce.number().int().positive().max(9000000000000).optional() }).parse(req.body);
        const result = await transitionFinancialCase(req.actor!, id, body);
        if ("error" in result) {
            const { code, ...response } = result;
            return reply.code(code).send(response);
        }
        return result;
    });
    app.post("/financial-cases/:caseId/pay", async (req, reply) => {
        if (!(req.actor!.role === "admin" || req.actor!.role === "accountant" || ["ceo", "finance_deputy", "finance_officer"].includes(req.actor!.position)))
            return reply.code(403).send({ error: "FORBIDDEN" });
        const id = uuid.parse((req.params as {
            caseId: string;
        }).caseId), body = period.extend({ fundId: uuid, paidAt: z.string().date(), referenceNo: z.string().trim().min(2).max(120), note: z.string().max(1000).default(""), receipt }).parse(req.body), key = z.string().min(8).max(200).optional().parse(req.headers["idempotency-key"]);
        let data: Buffer | null = null;
        let receiptHash: string | null = null;
        if (body.receipt) {
            data = Buffer.from(body.receipt.contentBase64, "base64");
            const check = inspectFile(data, body.receipt.mimeType);
            if (!check.ok) {
                await securityEvent("file.rejected", req, { fileName: body.receipt.fileName, mimeType: body.receipt.mimeType, error: check.error }, req.actor!.id);
                return reply.code(check.error === "FILE_SIZE_INVALID" ? 413 : 400).send({ error: check.error });
            }
            receiptHash = check.sha256;
        }
        const fingerprint = createHash("sha256").update(JSON.stringify({ caseId: id, fundId: body.fundId, jalaliYear: body.jalaliYear, jalaliMonth: body.jalaliMonth, paidAt: body.paidAt, referenceNo: body.referenceNo, note: body.note, receipt: body.receipt ? { fileName: body.receipt.fileName, mimeType: body.receipt.mimeType, sha256: createHash("sha256").update(data!).digest("hex") } : null })).digest("hex"), result = await payFinancialCase(req.actor!, id, body, key, data, receiptHash, fingerprint);
        if ("error" in result)
            return reply.code(result.code as 404 | 409).send(result);
        if (result.replayed)
            reply.header("idempotency-replayed", "true");
        return reply.code(201).send({ paymentId: result.paymentId });
    });
    app.get("/payments/:id/receipt", async (req, reply) => {
        const id = uuid.parse((req.params as {
            id: string;
        }).id), r = await pool.query("SELECT p.receipt_file_name,p.receipt_mime_type,p.receipt_data,fc.family_id FROM financial_payments p JOIN financial_cases fc ON fc.id=p.financial_case_id WHERE p.id=$1 AND p.receipt_data IS NOT NULL", [id]);
        if (!r.rowCount)
            return reply.code(404).send({ error: "RECEIPT_NOT_FOUND" });
        if (!await canViewFamily(req.actor!, r.rows[0].family_id))
            return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
        const reason = accessReason(req);
        if (!reason)
            return reply.code(400).send({ error: "ACCESS_REASON_REQUIRED" });
        await recordSensitiveAccess(req, r.rows[0].family_id, "payment_receipt", id, reason);
        reply.header("content-type", r.rows[0].receipt_mime_type).header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(r.rows[0].receipt_file_name)}`);
        return reply.send(r.rows[0].receipt_data);
    });
}
