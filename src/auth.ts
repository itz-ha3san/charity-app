import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db.js";
import { config } from "./config.js";
export type Actor = {
  id: string;
  name: string;
  role: "admin" | "caseworker" | "accountant" | "viewer";
  position:
    | "ceo"
    | "supervision_deputy"
    | "finance_deputy"
    | "finance_officer"
    | "health_officer"
    | "education_officer"
    | "health_deputy"
    | "education_deputy"
    | "liaison"
    | "viewer";
  isSuperAdmin?: boolean;
  username?: string;
  mustChangePassword: boolean;
};
declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
}
const tokenHash = (v: string) => createHash("sha256").update(v).digest("hex");
type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};
export async function createSession(
  userId: string,
  reply: FastifyReply,
  db: Queryable = pool,
) {
  const token = randomBytes(32).toString("base64url"),
    expires = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600000);
  await db.query(
    "INSERT INTO sessions(user_id,token_hash,expires_at,last_seen_at)VALUES($1,$2,$3,now())",
    [userId, tokenHash(token), expires],
  );
  reply.setCookie("sid", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.COOKIE_SECURE,
    path: "/",
    expires,
  });
}
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies.sid;
  if (!token) return reply.code(401).send({ error: "AUTH_REQUIRED" });
  const hash = tokenHash(token),
    q = await pool.query(
      `SELECT u.id,u.username,u.is_super_admin "isSuperAdmin",u.display_name name,u.role,u.position,u.must_change_password "mustChangePassword",s.id "sessionId" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
      [hash],
    );
  if (!q.rowCount) {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hash]);
    reply.clearCookie("sid", { path: "/" });
    return reply.code(401).send({ error: "SESSION_INVALID" });
  }
  req.actor = q.rows[0];
  await pool.query("UPDATE sessions SET last_seen_at=now() WHERE id=$1", [
    q.rows[0].sessionId,
  ]);
  if (req.actor!.mustChangePassword && req.url.startsWith("/api/"))
    return reply.code(403).send({ error: "PASSWORD_CHANGE_REQUIRED" });
}
export function allow(...roles: Actor["role"][]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.actor || !roles.includes(req.actor.role))
      return reply.code(403).send({ error: "FORBIDDEN" });
  };
}
export const hashPassword = (p: string) =>
  argon2.hash(p, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
export const verifyPassword = argon2.verify;

export async function requireSuperAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (!req.actor?.isSuperAdmin)
    return reply.code(403).send({ error: "SUPER_ADMIN_REQUIRED" });
}
