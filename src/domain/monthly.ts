import { createHash } from 'node:crypto';
import { DomainError } from './errors.js';
export type MonthlyAid = {
    id: string;
    familyId: string;
    title: string;
    category: string;
    amount: string;
};
export type MonthlyFamily = {
    id: string;
    caseNumber: string;
    familyName: string;
    supervisorId: string | null;
    supervisorName: string;
    baseAmount: string | null;
    aids: MonthlyAid[];
    conflict: boolean;
};
export function monthlyAmount(value: unknown): string | null {
    if (value === null || value === undefined || value === '')
        return null;
    const raw = String(value).trim().replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.includes(d) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(d) : '٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '');
    if (!/^\d+$/.test(raw))
        return null;
    const n = BigInt(raw);
    return n <= 9000000000000n ? n.toString() : null;
}
export function monthlySnapshot(families: MonthlyFamily[], selectedIds: string[]) {
    if (new Set(selectedIds).size !== selectedIds.length)
        throw new DomainError(400, 'MONTHLY_INVALID_AID');
    const available = new Map(families.flatMap(f => f.aids.map(a => [a.id, a] as const)));
    if (selectedIds.some(id => !available.has(id)))
        throw new DomainError(409, 'MONTHLY_AID_CHANGED');
    const selected = new Set(selectedIds);
    const rows = families.map(f => { const extras = f.aids.filter(a => selected.has(a.id)); const extraAmount = extras.reduce((s, a) => s + BigInt(a.amount), 0n); return { ...f, extras, extraAmount: extraAmount.toString(), totalAmount: (BigInt(f.baseAmount ?? '0') + extraAmount).toString() }; });
    const groups = new Map<string, {
        supervisorId: string | null;
        supervisorName: string;
        families: typeof rows;
        totalAmount: string;
    }>();
    for (const row of rows) {
        const key = row.supervisorId ?? 'unassigned';
        let group = groups.get(key);
        if (!group) {
            group = { supervisorId: row.supervisorId, supervisorName: row.supervisorName, families: [], totalAmount: '0' };
            groups.set(key, group);
        }
        group.families.push(row);
        group.totalAmount = (BigInt(group.totalAmount) + BigInt(row.totalAmount)).toString();
    }
    const baseAmount = rows.reduce((s, r) => s + BigInt(r.baseAmount ?? '0'), 0n), extraAmount = rows.reduce((s, r) => s + BigInt(r.extraAmount), 0n);
    return { groups: [...groups.values()], familyCount: rows.length, baseAmount: baseAmount.toString(), extraAmount: extraAmount.toString(), totalAmount: (baseAmount + extraAmount).toString(), missingAmounts: rows.filter(r => r.baseAmount === null).map(r => r.id), conflictingFamilies: rows.filter(r => r.conflict).map(r => r.id) };
}
export function monthlyRevision(families: MonthlyFamily[]) { return createHash('sha256').update(JSON.stringify(families)).digest('hex'); }
