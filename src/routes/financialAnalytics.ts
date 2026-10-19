import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, tx } from '../db.js';
import { requireAuth, type Actor } from '../auth.js';
import { familyViewScope } from '../scope.js';
import { jalaliPeriod, shiftPeriod, forecastRecordedMonths, planningEnvelope } from '../domain/financialAnalytics.js';
export const canReadFinancialAnalytics = (a: Pick<Actor, 'role' | 'position'>) => a.role === 'admin' || a.role === 'accountant' || ['ceo', 'finance_deputy', 'finance_officer'].includes(a.position);
const filter = z.object({ familyId: z.string().uuid().optional(), fundId: z.string().uuid().optional(), category: z.string().trim().min(1).max(100).optional(), archive: z.enum(['all', 'active', 'archived']).default('all') }).strict();
export async function registerFinancialAnalyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', async (req, reply) => { if (!canReadFinancialAnalytics(req.actor!)) return reply.code(403).send({ error: 'FORBIDDEN' }); });
  app.get('/financial-analytics/families', async req => {
    const q = z.object({ q: z.string().trim().max(80).default('') }).strict().parse(req.query);
    const scope = familyViewScope(req.actor!, 'f', 1);
    const r = await pool.query(`SELECT f.id,f.case_number "caseNumber",f.archived FROM families f WHERE f.case_number ILIKE $1 AND (${scope.sql}) ORDER BY f.case_number LIMIT 30`, [`%${q.q.replace(/[\\%_]/g, '\\$&')}%`, ...scope.params]);
    return { families: r.rows, limit: 30 };
  });
  app.get('/financial-analytics', async (req, reply) => {
    const q = filter.parse(req.query), current = jalaliPeriod(), next = shiftPeriod(current, 1), first = shiftPeriod(current, -12);
    const result = await tx(async c => {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const scope = familyViewScope(req.actor!, 'f');
      const params: unknown[] = [...scope.params];
      const bind = (value: unknown) => { params.push(value); return '$' + params.length; };
      const where = [`(${scope.sql})`];
      if (q.familyId) where.push(`f.id=${bind(q.familyId)}`);
      if (q.archive !== 'all') where.push(`f.archived=${bind(q.archive === 'archived')}`);
      const familyWhere = where.join(' AND ');
      if (q.familyId && !(await c.query(`SELECT 1 FROM families f WHERE ${familyWhere}`, params)).rowCount) return null;
      if (q.category) where.push(`fc.category=${bind(q.category)}`);
      // Fund has no allocation on unpaid requests: a fund filter intentionally suppresses commitments.
      const fundWhere = q.fundId ? ` AND p.fund_id=${bind(q.fundId)}` : '';
      const start = bind(first.year * 12 + first.month), end = bind(current.year * 12 + current.month);
      const r = await c.query(`SELECT p.jalali_year AS "year",p.jalali_month AS "month",fc.category,SUM(p.amount)::text amount,COUNT(*)::int payments FROM financial_payments p JOIN financial_cases fc ON fc.id=p.financial_case_id JOIN families f ON f.id=fc.family_id WHERE ${where.join(' AND ')}${fundWhere} AND p.jalali_year*12+p.jalali_month BETWEEN ${start} AND ${end} GROUP BY p.jalali_year,p.jalali_month,fc.category ORDER BY "year","month",fc.category`, params);
      const hParams: unknown[] = [...scope.params];
      const hWhere = [`(${scope.sql})`];
      const hb = (v: unknown) => { hParams.push(v); return '$' + hParams.length; };
      if (q.familyId) hWhere.push(`f.id=${hb(q.familyId)}`);
      if (q.archive !== 'all') hWhere.push(`f.archived=${hb(q.archive === 'archived')}`);
      if (q.category) hWhere.push(`fc.category=${hb(q.category)}`);
      if (q.fundId) hWhere.push(`p.fund_id=${hb(q.fundId)}`);
      const origin = await c.query(`SELECT MIN(p.jalali_year*12+p.jalali_month)::int "firstPeriod" FROM financial_payments p JOIN financial_cases fc ON fc.id=p.financial_case_id JOIN families f ON f.id=fc.family_id WHERE ${hWhere.join(' AND ')}`, hParams);
      const commitments = q.fundId ? { rows: [] } : await c.query(`SELECT fc.category,SUM(COALESCE(fc.approved_amount,fc.amount))::text amount FROM financial_cases fc JOIN families f ON f.id=fc.family_id WHERE ${hWhere.join(' AND ')} AND NOT f.archived AND fc.status IN ('تأیید شده','ارجاع به حسابدار') AND NOT EXISTS(SELECT 1 FROM financial_payments p WHERE p.financial_case_id=fc.id) AND fc.jalali_year=${hb(next.year)} AND fc.jalali_month=${hb(next.month)} GROUP BY fc.category`, hParams);
      return { rows: r.rows, firstPeriod: origin.rows[0].firstPeriod as number | null, commitments: commitments.rows };
    });
    if (!result) return reply.code(404).send({ error: 'FAMILY_NOT_FOUND' });
    const months = Array.from({ length: 12 }, (_, i) => shiftPeriod(first, i));
    const monthly = months.map(p => {
      const rows = result.rows.filter(r => r.year === p.year && r.month === p.month);
      const recorded = result.firstPeriod !== null && p.year * 12 + p.month >= result.firstPeriod;
      return { ...p, amount: recorded ? rows.reduce((n, r) => n + BigInt(r.amount), 0n).toString() : null, payments: recorded ? rows.reduce((n, r) => n + r.payments, 0) : null };
    });
    const history = monthly.filter(x => x.amount !== null);
    const forecast = forecastRecordedMonths(history.map(x => x.amount!));
    const committed = result.commitments.reduce((n, r) => n + BigInt(r.amount), 0n).toString();
    const categories = [...new Set([...result.rows.map(r => r.category), ...result.commitments.map(r => r.category)])].sort().map(category => {
      const values = history.map(p => result.rows.filter(r => r.year === p.year && r.month === p.month && r.category === category).reduce((n, r) => n + BigInt(r.amount), 0n).toString());
      return { category, paid: values.reduce((n, v) => n + BigInt(v), 0n).toString(), committed: result.commitments.find(r => r.category === category)?.amount ?? '0', forecast: forecastRecordedMonths(values) };
    });
    const currentRows = result.rows.filter(r => r.year === current.year && r.month === current.month);
    return { unit: 'تومان', generatedAt: new Date().toISOString(), filters: q, current: { ...current, amount: currentRows.reduce((n, r) => n + BigInt(r.amount), 0n).toString(), partial: true }, next, monthly, categories, committed: q.fundId ? null : committed, forecast, plan: planningEnvelope(forecast, committed), totalPaid: history.reduce((n, r) => n + BigInt(r.amount!), 0n).toString(), methodology: { version: 'recorded-cash-v1', periodBasis: 'payment_accounting_jalali_period', coverage: 'recorded_payments_not_verified_completeness', nonCashIncluded: false, llmUsed: false, commitmentsIncluded: !q.fundId, commitmentsScope: 'next_month_explicit_approved_unpaid_active_families', combination: 'maximum_not_sum', warning: 'ثبت‌نشدن پرداخت الزاماً به معنی نبود هزینه نیست. برآورد فقط پرداخت نقدی ثبت‌شده است؛ بودجه و پیش‌بینی جای تصمیم انسانی نیستند.' } };
  });
}
