import type { Pool, PoolClient } from 'pg';
import { pool } from './db.js';
import type { Actor } from './auth.js';

type Database = Pool | PoolClient;
export type SpecialistDomain = 'health' | 'education';
export const globalFamilyAccess = (a: Actor) => a.role === 'admin' || ['ceo','supervision_deputy','health_deputy','education_deputy'].includes(a.position);
export const financeAccess = (a: Actor) => a.role === 'accountant' || ['finance_deputy','finance_officer'].includes(a.position);
export const canReviewSupervision = (a: Pick<Actor,'role'|'position'>) => a.role === 'admin' || ['ceo','supervision_deputy'].includes(a.position);
export const specialistDomain = (a: Pick<Actor,'position'>): SpecialistDomain | null =>
  ['health_officer','health_deputy'].includes(a.position) ? 'health' : ['education_officer','education_deputy'].includes(a.position) ? 'education' : null;
export const canManageSpecialist = (a: Pick<Actor,'role'|'position'>, domain?: string) =>
  a.role === 'admin' || a.position === 'ceo' ||
  (['health_deputy','education_deputy'].includes(a.position) && (!domain || specialistDomain(a) === domain));
export const hasSpecialistAccess = (a: Pick<Actor,'role'|'position'>) => canManageSpecialist(a) || specialistDomain(a) !== null;

// Reused by inbox, family listings, documents and comprehensive views. Alias names
// are code-owned, never request input. Values always remain bound parameters.
export function specialistCaseScope(a: Pick<Actor,'id'|'role'|'position'>, alias = 's', offset = 0): { sql: string; params: string[] } {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error('INVALID_SQL_ALIAS');
  if (a.role === 'admin' || a.position === 'ceo') return {sql:'TRUE',params:[]};
  const domain = specialistDomain(a);
  if (!domain) return {sql:'FALSE',params:[]};
  if (canManageSpecialist(a,domain)) return {sql:`${alias}.domain=$${offset+1}`,params:[domain]};
  return {sql:`${alias}.domain=$${offset+1} AND ${alias}.assigned_to=$${offset+2} AND EXISTS (SELECT 1 FROM service_referrals ar WHERE ar.id=${alias}.service_referral_id AND ar.family_id=${alias}.family_id AND ar.domain=${alias}.domain AND ar.assigned_to=${alias}.assigned_to AND ar.status IN ('open','in_progress'))`,params:[domain,a.id]};
}
export function canAccessSpecialistCase(a: Pick<Actor,'id'|'role'|'position'>, x: Record<string,any>) {
  if (canManageSpecialist(a,x.domain)) return true;
  return specialistDomain(a) === x.domain && x.assigned_to === a.id && x.referral_assigned_to === a.id &&
    x.referral_domain === x.domain && x.referral_family_id === x.family_id && ['open','in_progress'].includes(x.referral_status);
}

// A family-scoped inbox must use the same current-assignment rules as detail routes.
export function familyViewScope(a: Actor, alias = 'f', offset = 0): {sql: string; params: string[]} {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error('INVALID_SQL_ALIAS');
  if (globalFamilyAccess(a) || financeAccess(a) || (a.role === 'viewer' && a.position === 'viewer')) return {sql:'TRUE',params:[]};
  if (a.position === 'liaison') return {
    sql:`EXISTS (SELECT 1 FROM families sf LEFT JOIN family_supervisor_assignments fa ON fa.family_id=sf.id AND fa.ends_at IS NULL LEFT JOIN supervisors su ON su.id=fa.supervisor_id AND su.active WHERE sf.id=${alias}.id AND (su.liaison_id=$${offset+1} OR sf.assigned_to=$${offset+1} OR (fa.id IS NULL AND sf.created_by=$${offset+1})))`,params:[a.id]
  };
  if (['health_officer','education_officer'].includes(a.position)) return {
    sql:`EXISTS (SELECT 1 FROM service_referrals sr WHERE sr.family_id=${alias}.id AND sr.assigned_to=$${offset+1} AND sr.domain=$${offset+2} AND sr.status IN ('open','in_progress'))`,params:[a.id,specialistDomain(a)!]
  };
  return {sql:'FALSE',params:[]};
}
export async function canViewFamily(a: Actor, familyId: string, db: Database = pool) {
  const scope=familyViewScope(a,'f',1);
  if(scope.sql==='TRUE')return true;
  const q=await db.query(`SELECT 1 FROM families f WHERE f.id=$1 AND (${scope.sql})`,[familyId,...scope.params]);
  return Boolean(q.rowCount);
}
export async function canWorkFamily(a: Actor, familyId: string, db: Database = pool) {
  if (globalFamilyAccess(a)) return true;
  return ['liaison','health_officer','education_officer'].includes(a.position) && await canViewFamily(a,familyId,db);
}
export async function canReadFullFamilyProfile(a: Actor, familyId: string, db: Database = pool) {
  if (a.role === 'admin' || a.position === 'ceo') return true;
  return a.position === 'liaison' && await canWorkFamily(a,familyId,db);
}
