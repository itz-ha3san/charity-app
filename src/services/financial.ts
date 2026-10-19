import { tx } from '../db.js';
import type { Actor } from '../auth.js';
import { canViewFamily, canWorkFamily, globalFamilyAccess } from '../scope.js';
import { lockedCase, log, lockFundPeriod } from '../repositories/financial.js';
import { financialTransitionRules, type FinancialDecision } from '../domain/financial.js';
export type FinancialFailure = {
    error: string;
    code: 400 | 403 | 404 | 409;
    requiredPosition?: string;
    from?: string;
    action?: string;
};
export async function transitionFinancialCase(actor: Actor, id: string, body: FinancialDecision) {
    const rule = financialTransitionRules[body.action];
    return await tx<FinancialFailure | {
        financialCaseId: string;
        status: string;
    }>(async (c) => {
        // All writers (edit, decision, payment) lock the same row before validating
        // its current state. A competing request rechecks after the lock is released.
        const r = await lockedCase(c, id);
        if (!r.rowCount)
            return { error: "FINANCIAL_CASE_NOT_FOUND", code: 404 };
        const x = r.rows[0];
        if (!await canViewFamily(actor, x.family_id, c))
            return { error: "FAMILY_SCOPE_FORBIDDEN", code: 403 };
        const required = String(x.required_approver_position ?? "education_deputy");
        const elevated = actor.role === "admin" || actor.position === "ceo" || actor.position === required;
        const scopedLiaison = actor.position === "liaison" && await canWorkFamily(actor, x.family_id, c);
        if (body.action === "review" && actor.id !== x.created_by && !elevated && !globalFamilyAccess(actor) && !scopedLiaison)
            return { error: "FORBIDDEN", code: 403 };
        if (body.action !== "review" && !elevated)
            return { error: "WRONG_FINANCIAL_APPROVER", requiredPosition: required, code: 403 };
        if (x.archived)
            return { error: "FAMILY_ARCHIVED", code: 409 };
        if (!(rule.from as readonly string[]).includes(String(x.status)))
            return { error: "INVALID_FINANCIAL_TRANSITION", from: x.status, action: body.action, code: 409 };
        if ((["reject", "cancel"].includes(body.action) || (body.action === "approve" && actor.role !== "admin")) && (!body.reason || body.reason.length < 3))
            return { error: "DECISION_NOTE_REQUIRED", code: 400 };
        const approvedAmount = body.action === "approve" ? BigInt(body.approvedAmount ?? x.amount) : null;
        if (approvedAmount !== null && approvedAmount > BigInt(x.amount))
            return { error: "APPROVED_AMOUNT_EXCEEDS_REQUEST", code: 400 };
        await c.query(`UPDATE financial_cases SET status=$2,approved_by=CASE WHEN $3='approve' THEN $4 ELSE approved_by END,approved_at=CASE WHEN $3='approve' THEN now() ELSE approved_at END,referred_at=CASE WHEN $3 IN ('refer','queue_payment') THEN now() ELSE referred_at END,rejected_by=CASE WHEN $3='reject' THEN $4 ELSE rejected_by END,rejected_at=CASE WHEN $3='reject' THEN now() ELSE rejected_at END,rejection_reason=CASE WHEN $3='reject' THEN $5 ELSE rejection_reason END,approved_amount=CASE WHEN $3='approve' THEN $6::bigint ELSE approved_amount END,decision_note=CASE WHEN $3 IN ('approve','reject','cancel') THEN COALESCE($5,'تأیید مدیر') ELSE decision_note END,cancelled_by=CASE WHEN $3='cancel' THEN $4 ELSE cancelled_by END,cancelled_at=CASE WHEN $3='cancel' THEN now() ELSE cancelled_at END,updated_at=now() WHERE id=$1`, [id, rule.to, body.action, actor.id, body.reason ?? null, approvedAmount?.toString() ?? null]);
        const sourceFinancialStatus = body.action === "approve" ? "approved" : ["reject", "cancel"].includes(body.action) ? "none" : null;
        if (sourceFinancialStatus) {
            const sourceCaseId = sourceFinancialStatus === "none" ? null : id;
            if (x.source_action_id)
                await c.query("UPDATE case_actions SET financial_status=$2,financial_case_id=$3,updated_at=now() WHERE id=$1", [x.source_action_id, sourceFinancialStatus, sourceCaseId]);
            if (x.source_specialist_case_id)
                await c.query("UPDATE specialist_cases SET financial_status=$2,financial_case_id=$3,updated_at=now() WHERE id=$1", [x.source_specialist_case_id, sourceFinancialStatus, sourceCaseId]);
            if (x.source_supervision_report_id)
                await c.query("UPDATE supervision_reports SET financial_status=$2,financial_case_id=$3,updated_at=now() WHERE id=$1", [x.source_supervision_report_id, sourceFinancialStatus, sourceCaseId]);
        }
        await c.query("INSERT INTO financial_case_events(financial_case_id,family_id,actor_id,action,from_status,to_status,note,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [id, x.family_id, actor.id, body.action, x.status, rule.to, body.reason ?? '', approvedAmount?.toString() ?? x.amount]);
        await log(c, actor.id, x.family_id, "financial.transition", { caseNumber: x.case_number, financialCaseId: id, title: x.title, amount: String(x.amount), fromStatus: x.status, status: rule.to, reason: body.reason });
        return { financialCaseId: id, status: rule.to };
    });
}
export interface PaymentCommand {
    fundId: string;
    jalaliYear: number;
    jalaliMonth: number;
    paidAt: string;
    referenceNo: string;
    note: string;
    receipt?: {
        fileName: string;
        mimeType: string;
    } | null;
}
export async function payFinancialCase(actor: Actor, id: string, body: PaymentCommand, key: string | undefined, data: Buffer | null, receiptHash: string | null, fingerprint: string) {
    return await tx(async (c) => {
        if (key) {
            await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`idempotency:${key}`]);
            const replay = await c.query("SELECT id,idempotency_request_hash FROM financial_payments WHERE idempotency_key=$1", [key]);
            if (replay.rowCount) {
                if (replay.rows[0].idempotency_request_hash !== fingerprint)
                    return { error: "IDEMPOTENCY_KEY_REUSED", code: 409 };
                return { paymentId: replay.rows[0].id, replayed: true, code: 201 };
            }
        }
        const locked = await lockedCase(c, id);
        if (!locked.rowCount)
            return { error: "FINANCIAL_CASE_NOT_FOUND", code: 404 };
        const x = locked.rows[0];
        if (x.archived)
            return { error: "FAMILY_ARCHIVED", code: 409 };
        const previous = await c.query("SELECT id FROM financial_payments WHERE financial_case_id=$1", [id]);
        if (previous.rowCount)
            return { error: "PAYMENT_ALREADY_EXISTS", code: 409, paymentId: previous.rows[0].id };
        if (x.status !== "ارجاع به حسابدار")
            return { error: "PAYMENT_NOT_ALLOWED", code: 409 };
        await lockFundPeriod(c, body.fundId, body.jalaliYear, body.jalaliMonth);
        if (!(await c.query("SELECT 1 FROM funds WHERE id=$1 AND active FOR SHARE", [body.fundId])).rowCount)
            return { error: "FUND_NOT_AVAILABLE", code: 409 };
        const budget = await c.query("SELECT amount::text amount FROM fund_budgets WHERE fund_id=$1 AND jalali_year=$2 AND jalali_month=$3", [body.fundId, body.jalaliYear, body.jalaliMonth]);
        if (!budget.rowCount)
            return { error: "BUDGET_NOT_DEFINED", code: 409 };
        const spent = await c.query("SELECT COALESCE(sum(amount),0)::text amount FROM financial_payments WHERE fund_id=$1 AND jalali_year=$2 AND jalali_month=$3", [body.fundId, body.jalaliYear, body.jalaliMonth]), amount = BigInt(x.approved_amount ?? x.amount), remaining = BigInt(budget.rows[0].amount) - BigInt(spent.rows[0].amount);
        if (remaining < amount)
            return { error: "BUDGET_EXCEEDED", code: 409, remaining: remaining.toString() };
        const q = await c.query(`INSERT INTO financial_payments(financial_case_id,fund_id,amount,jalali_year,jalali_month,paid_at,reference_no,note,receipt_file_name,receipt_mime_type,receipt_data,receipt_size_bytes,created_by,idempotency_key,idempotency_request_hash,receipt_sha256,receipt_scan_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`, [id, body.fundId, amount.toString(), body.jalaliYear, body.jalaliMonth, body.paidAt, body.referenceNo, body.note, body.receipt?.fileName ?? null, body.receipt?.mimeType ?? null, data, data?.length ?? null, actor.id, key ?? null, key ? fingerprint : null, receiptHash, body.receipt ? "clean" : "legacy"]);
        await c.query("UPDATE financial_cases SET status='پرداخت شده',updated_at=now() WHERE id=$1", [id]);
        if (x.source_action_id)
            await c.query("UPDATE case_actions SET financial_status='paid',financial_case_id=$2,updated_at=now() WHERE id=$1", [x.source_action_id, id]);
        if (x.source_specialist_case_id)
            await c.query("UPDATE specialist_cases SET financial_status='paid',financial_case_id=$2,updated_at=now() WHERE id=$1", [x.source_specialist_case_id, id]);
        if (x.source_supervision_report_id)
            await c.query("UPDATE supervision_reports SET financial_status='paid',financial_case_id=$2,updated_at=now() WHERE id=$1", [x.source_supervision_report_id, id]);
        await c.query("INSERT INTO financial_case_events(financial_case_id,family_id,actor_id,action,from_status,to_status,note,amount) VALUES($1,$2,$3,'pay',$4,'پرداخت شده',$5,$6)", [id, x.family_id, actor.id, x.status, body.note, amount.toString()]);
        await log(c, actor.id, x.family_id, "financial.payment", { caseNumber: x.case_number, financialCaseId: id, paymentId: q.rows[0].id, amount: amount.toString(), fundId: body.fundId, status: "پرداخت شده", referenceNo: body.referenceNo });
        return { paymentId: q.rows[0].id, replayed: false, code: 201 };
    });
}
