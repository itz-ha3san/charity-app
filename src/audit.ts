import type { Pool, PoolClient } from 'pg';
/** Append-only audit writes participate in the business transaction when supplied. */
export interface AuditEvent {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown>;
}
export function recordAudit(db: Pool | PoolClient, event: AuditEvent) {
    return db.query('INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)', [event.actorId, event.action, event.entityType, event.entityId, event.details]);
}
