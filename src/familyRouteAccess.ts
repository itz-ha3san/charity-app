import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from './db.js';
import { canViewFamily, canWorkFamily, financeAccess } from './scope.js';

// Common scope checks supplement (never replace) each route's operation/role
// checks. Resolve the stored parent, not a caller-supplied familyId for child IDs.
const uuid = z.string().uuid();
const childTables: Record<string,string> = {
  notes:'notes', documents:'family_documents', 'financial-cases':'financial_cases',
  actions:'case_actions', 'supervision-reports':'supervision_reports',
  'family-change-requests':'family_change_requests', referrals:'service_referrals',
  'specialist-cases':'specialist_cases', 'specialist-documents':'specialist_case_documents',
  'financial-documents':'financial_case_documents',
};
export async function authorizeFamilyRoute(req: FastifyRequest, reply: FastifyReply) {
  if (!req.actor) return;
  const route = (req.routeOptions.url ?? '').replace(/^\/api(?=\/)/,'');
  const parts = route.split('/').filter(Boolean), resource = parts[0];
  const params = req.params as Record<string,unknown> | undefined;
  const body = req.body as Record<string,unknown> | undefined;
  let familyId: string | undefined;
  let childId: unknown;
  let sql: string | undefined;
  if (resource === 'families' && parts[1] === ':id') {
    const parsed=uuid.safeParse(params?.id);if(!parsed.success)return;familyId=parsed.data;
  } else if (resource && childTables[resource] && parts[1]?.startsWith(':')) {
    childId=params?.[parts[1].slice(1)];
    sql=`SELECT family_id FROM ${childTables[resource]} WHERE id=$1`;
  } else if (resource === 'payments' && parts[1] === ':id') {
    childId=params?.id;
    sql='SELECT fc.family_id FROM financial_payments p JOIN financial_cases fc ON fc.id=p.financial_case_id WHERE p.id=$1';
  } else if (route === '/financial-sources/request') {
    const tables: Record<string,string> = {action:'case_actions',weekly_report:'supervision_reports',health_case:'specialist_cases',education_case:'specialist_cases'};
    const table=typeof body?.sourceType === 'string' ? tables[body.sourceType] : undefined;
    if(table){childId=body?.sourceId;sql=`SELECT family_id FROM ${table} WHERE id=$1`;}
  } else if (route === '/inventory/transactions' || route === '/donations/:id/allocate' || route === '/messages') {
    const parsed=uuid.safeParse(body?.familyId);if(!parsed.success)return;familyId=parsed.data;
  }
  if(sql){
    const parsed=uuid.safeParse(childId);if(!parsed.success)return;
    const q=await pool.query(sql,[parsed.data]);
    // Let the route keep its resource-specific 404 contract.
    if(!q.rowCount)return;familyId=q.rows[0].family_id;
  }
  if(!familyId)return;
  if(!await canViewFamily(req.actor,familyId))return reply.code(403).send({error:'FAMILY_SCOPE_FORBIDDEN'});
  const write=!['GET','HEAD','OPTIONS'].includes(req.method);
  if(!write)return;
  const financial=Boolean(resource && ['financial-cases','financial-documents','financial-sources','payments'].includes(resource));
  const financeNote=(resource==='notes'||route==='/families/:id/notes')&&req.actor.position==='finance_deputy';
  // Messages are organizational communication, not an edit to the referenced
  // family's record. Their sender/recipient policy remains in messages.ts.
  if(route==='/messages')return;
  if(!await canWorkFamily(req.actor,familyId)&&!(financial&&financeAccess(req.actor))&&!financeNote)
    return reply.code(403).send({error:'FAMILY_SCOPE_FORBIDDEN'});
  if(route==='/families/:id/archive'||route==='/families/:id/unarchive')return;
  const f=await pool.query('SELECT archived FROM families WHERE id=$1',[familyId]);
  if(f.rows[0]?.archived)return reply.code(409).send({error:'FAMILY_ARCHIVED'});
}
