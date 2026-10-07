import type { PoolClient } from "pg";
import type { Actor } from "./auth.js";
import { globalFamilyAccess } from "./scope.js";
import { z } from "zod";
export async function applySupervisor(
  c: PoolClient,
  actor: Actor,
  familyId: string,
  supervisorId: string | null | undefined,
) {
  if (supervisorId === undefined) return;
  if (supervisorId) {
    const s = await c.query(
      "SELECT id,liaison_id FROM supervisors WHERE id=$1 AND active FOR UPDATE",
      [supervisorId],
    );
    if (
      !s.rowCount ||
      (!globalFamilyAccess(actor) && s.rows[0].liaison_id !== actor.id)
    )
      throw new z.ZodError([
        {
          code: "custom",
          path: ["supervisorId"],
          message: "INVALID_SUPERVISOR",
        },
      ]);
  }
  await c.query("SELECT id FROM families WHERE id=$1 FOR UPDATE", [familyId]);
  const existing = await c.query(
    "SELECT supervisor_id FROM family_supervisor_assignments WHERE family_id=$1 AND ends_at IS NULL",
    [familyId],
  );
  if ((existing.rows[0]?.supervisor_id ?? null) === supervisorId) return;
  await c.query(
    "UPDATE family_supervisor_assignments SET ends_at=now() WHERE family_id=$1 AND ends_at IS NULL",
    [familyId],
  );
  await c.query("UPDATE families SET profile_data=profile_data||$2::jsonb,updated_at=now() WHERE id=$1",[familyId,{supervisorId}]);
  if (supervisorId) {
    await c.query(
      "INSERT INTO family_supervisor_assignments(family_id,supervisor_id,assigned_by,reason)VALUES($1,$2,$3,'انتخاب در فرم پرونده')",
      [familyId, supervisorId, actor.id],
    );
    await c.query(
      "INSERT INTO family_supervision_plans(family_id,next_due_at,updated_by)VALUES($1,current_date+7,$2) ON CONFLICT(family_id)DO UPDATE SET active=true,updated_by=$2,updated_at=now()",
      [familyId, actor.id],
    );
  } else
    await c.query(
      "UPDATE family_supervision_plans SET active=false,updated_at=now() WHERE family_id=$1",
      [familyId],
    );
  await c.query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)VALUES($1,'family.supervisor.assign','family',$2,$3)",
    [actor.id, familyId, { supervisorId }],
  );
}
