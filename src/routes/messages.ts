import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool, tx } from "../db.js";
import { requireAuth } from "../auth.js";
import { canViewFamily } from "../scope.js";

const uuid = z.string().uuid();
const senderPositions = new Set([
  "admin",
  "ceo",
  "supervision_deputy",
  "health_deputy",
  "education_deputy",
  "finance_deputy",
]);
const positionNames: Record<string, string> = {
  admin: "مدیر سامانه",
  ceo: "معاون کل",
  supervision_deputy: "معاون سرپرستی",
  health_deputy: "معاون بهداشت",
  education_deputy: "معاون آموزشی",
  finance_deputy: "معاون مالی",
};
const canSend = (actor: { role: string; position: string }) =>
  actor.role === "admin" || senderPositions.has(actor.position);

export async function registerMessageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/messages/recipients", async (req, reply) => {
    if (!canSend(req.actor!))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const result = await pool.query(
      "SELECT id,display_name AS name FROM users WHERE active AND position='liaison' ORDER BY display_name",
    );
    return { recipients: result.rows };
  });

  app.get("/messages/inbox", async (req) => {
    const query = z
      .object({
        includeRead: z.preprocess(
          (value) => value === true || value === "true",
          z.boolean(),
        ),
      })
      .parse(req.query);
    const result = await pool.query(
      `SELECT m.id,m.sender_name AS "senderName",m.sender_position AS "senderPosition",
        m.title,m.body,m.severity,m.acknowledgement_required AS "acknowledgementRequired",
        m.created_at AS "createdAt",r.read_at AS "readAt",r.acknowledged_at AS "acknowledgedAt",
        CASE WHEN f.id IS NULL THEN NULL ELSE m.family_id END AS "familyId",
        f.case_number AS "caseNumber",f.head_name AS "headName"
       FROM liaison_message_recipients r
       JOIN liaison_messages m ON m.id=r.message_id
       LEFT JOIN families f ON f.id=m.family_id
         AND (f.assigned_to=r.recipient_id
           OR EXISTS(SELECT 1 FROM family_supervisor_assignments fa
             JOIN supervisors s ON s.id=fa.supervisor_id
             WHERE fa.family_id=f.id AND fa.ends_at IS NULL AND s.active
               AND s.liaison_id=r.recipient_id)
           OR (NOT EXISTS(SELECT 1 FROM family_supervisor_assignments fa
             WHERE fa.family_id=f.id AND fa.ends_at IS NULL)
             AND f.created_by=r.recipient_id))
       WHERE r.recipient_id=$1 AND ($2::boolean OR r.read_at IS NULL)
         AND (m.family_id IS NULL OR f.id IS NOT NULL)
       ORDER BY CASE m.severity WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
         m.created_at DESC
       LIMIT 100`,
      [req.actor!.id, query.includeRead],
    );
    return {
      messages: result.rows,
      unread: result.rows.filter((message) => !message.readAt).length,
    };
  });

  app.post("/messages", async (req, reply) => {
    if (!canSend(req.actor!))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const body = z
      .object({
        title: z.string().trim().min(2).max(180),
        body: z.string().trim().min(3).max(5000),
        severity: z.enum(["important", "urgent", "critical"]).default("important"),
        acknowledgementRequired: z.boolean().default(false),
        recipientIds: z.array(uuid).max(500).default([]),
        allLiaisons: z.boolean().default(false),
        familyId: uuid.nullable().optional(),
      })
      .refine(
        (value) =>
          value.allLiaisons
            ? value.recipientIds.length === 0
            : value.recipientIds.length > 0,
        { message: "RECIPIENTS_REQUIRED", path: ["recipientIds"] },
      )
      .parse(req.body);

    let recipientIds: string[];
    if (body.allLiaisons) {
      const recipients = await pool.query(
        "SELECT id FROM users WHERE active AND position='liaison' ORDER BY id",
      );
      recipientIds = recipients.rows.map((row) => row.id as string);
    } else {
      recipientIds = [...new Set<string>(body.recipientIds as string[])];
      const recipients = await pool.query(
        "SELECT id FROM users WHERE active AND position='liaison' AND id=ANY($1::uuid[])",
        [recipientIds],
      );
      if (recipients.rowCount !== recipientIds.length)
        return reply.code(400).send({ error: "INVALID_MESSAGE_RECIPIENT" });
    }
    if (!recipientIds.length)
      return reply.code(400).send({ error: "NO_ACTIVE_LIAISONS" });

    if (body.familyId) {
      if (!(await canViewFamily(req.actor!, body.familyId)))
        return reply.code(403).send({ error: "FAMILY_SCOPE_FORBIDDEN" });
      const visible = await pool.query(
        `SELECT u.id FROM users u JOIN families f ON f.id=$2
         WHERE u.id=ANY($1::uuid[]) AND u.active AND u.position='liaison'
           AND (f.assigned_to=u.id
             OR EXISTS(SELECT 1 FROM family_supervisor_assignments fa
               JOIN supervisors s ON s.id=fa.supervisor_id
               WHERE fa.family_id=f.id AND fa.ends_at IS NULL AND s.active
                 AND s.liaison_id=u.id)
             OR (NOT EXISTS(SELECT 1 FROM family_supervisor_assignments fa
               WHERE fa.family_id=f.id AND fa.ends_at IS NULL)
               AND f.created_by=u.id))`,
        [recipientIds, body.familyId],
      );
      if (visible.rowCount !== recipientIds.length)
        return reply.code(400).send({ error: "FAMILY_NOT_ASSIGNED_TO_RECIPIENTS" });
    }

    const messageId = await tx(async (client) => {
      const created = await client.query(
        `INSERT INTO liaison_messages
          (sender_id,sender_name,sender_position,title,body,severity,acknowledgement_required,family_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          req.actor!.id,
          req.actor!.name,
          positionNames[req.actor!.position] || "مدیر سامانه",
          body.title,
          body.body,
          body.severity,
          body.acknowledgementRequired || body.severity === "critical",
          body.familyId ?? null,
        ],
      );
      const id = created.rows[0].id as string;
      await client.query(
        `INSERT INTO liaison_message_recipients(message_id,recipient_id)
         SELECT $1,recipient_id FROM unnest($2::uuid[]) AS recipients(recipient_id)`,
        [id, recipientIds],
      );
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details)
         VALUES($1,'liaison.message.send','liaison_message',$2,$3)`,
        [req.actor!.id, id, { recipientCount: recipientIds.length, severity: body.severity }],
      );
      return id;
    });
    return reply.code(201).send({ messageId, recipientCount: recipientIds.length });
  });

  app.post("/messages/:id/read", async (req, reply) => {
    const id = uuid.parse((req.params as { id: string }).id);
    const result = await pool.query(
      `UPDATE liaison_message_recipients SET read_at=COALESCE(read_at,now())
       WHERE message_id=$1 AND recipient_id=$2 RETURNING message_id`,
      [id, req.actor!.id],
    );
    if (!result.rowCount) return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });
    return { messageId: id, read: true };
  });

  app.post("/messages/:id/acknowledge", async (req, reply) => {
    const id = uuid.parse((req.params as { id: string }).id);
    const result = await pool.query(
      `UPDATE liaison_message_recipients r SET
         read_at=COALESCE(r.read_at,now()),acknowledged_at=now()
       FROM liaison_messages m
       WHERE r.message_id=m.id AND r.message_id=$1 AND r.recipient_id=$2
         AND m.acknowledgement_required RETURNING r.message_id`,
      [id, req.actor!.id],
    );
    if (!result.rowCount) return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });
    return { messageId: id, acknowledged: true };
  });
}