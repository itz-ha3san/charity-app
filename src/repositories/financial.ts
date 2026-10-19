import type { PoolClient } from "pg";
import { recordAudit } from "../audit.js";
export const lockedCase = (c: PoolClient, id: string) => c.query(`SELECT fc.*,f.case_number,f.archived FROM financial_cases fc JOIN families f ON f.id=fc.family_id WHERE fc.id=$1 FOR UPDATE OF fc`, [id]);
export const log = (db: PoolClient, actor: string, family: string, action: string, details: Record<string, unknown>) => recordAudit(db, { actorId: actor, action, entityType: 'family', entityId: family, details });
export async function lockFundPeriod(db: PoolClient, fundId: string, year: number, month: number) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${fundId}:${year}:${month}`]);
}
