import type { Pool, PoolClient } from 'pg';
import { pool } from '../db.js';
import type { Actor } from '../auth.js';
import { canViewFamily, canWorkFamily, financeAccess } from '../scope.js';
export interface FamilyOperation {
    write: boolean;
    financial?: boolean;
    financeNote?: boolean;
    communication?: boolean;
    archiveTransition?: boolean;
}
/** Shared family boundary; route-specific role/department checks must still run. */
export async function familyOperationFailure(actor: Actor, familyId: string, operation: FamilyOperation, db: Pool | PoolClient = pool): Promise<'FAMILY_SCOPE_FORBIDDEN' | 'FAMILY_ARCHIVED' | null> {
    if (!await canViewFamily(actor, familyId, db))
        return 'FAMILY_SCOPE_FORBIDDEN';
    if (!operation.write || operation.communication)
        return null;
    if (!await canWorkFamily(actor, familyId, db) && !(operation.financial && financeAccess(actor)) && !(operation.financeNote && actor.position === 'finance_deputy'))
        return 'FAMILY_SCOPE_FORBIDDEN';
    if (operation.archiveTransition)
        return null;
    const family = await db.query('SELECT archived FROM families WHERE id=$1', [familyId]);
    return family.rows[0]?.archived ? 'FAMILY_ARCHIVED' : null;
}
