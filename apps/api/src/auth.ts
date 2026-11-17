import { randomBytes, createHash } from "node:crypto";
import { hash, verify } from "argon2";
import { eq } from "drizzle-orm";
import { db, pool, transaction, type Tx } from "@dc/db";
import { schema } from "@dc/db";
const { users } = schema;
import type { SessionUser } from "@dc/contracts";
import type { Request, Response, NextFunction } from "express";
import { fail } from "./errors";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const dummy = hash(randomBytes(32).toString("hex"));
export type Actor = SessionUser & {
  sessionId: string;
  csrfToken: string;
  bearer: boolean;
};
export async function actorUser(user: any): Promise<SessionUser> {
  const branches = (
    await pool.query(
      "SELECT b.id,b.name FROM user_branches ub JOIN branches b ON b.id=ub.branch_id WHERE ub.user_id=$1 AND b.active ORDER BY b.name",
      [user.id],
    )
  ).rows;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    businessId: user.business_id || user.businessId,
    branches,
  };
}
export async function login(username: string, password: string) {
  const user = (
    await db.select().from(users).where(eq(users.username, username)).limit(1)
  )[0];
  const valid = await verify(
    user?.passwordHash || (await dummy),
    password,
  ).catch(() => false);
  if (!valid || !user?.active)
    fail(401, "INVALID_CREDENTIALS", "Username atau password salah.");
  const token = randomBytes(32).toString("base64url"),
    csrfToken = randomBytes(24).toString("base64url");
  return transaction(async (tx) => {
    const live = (
      await tx.query("SELECT * FROM app_users WHERE id=$1 FOR SHARE", [user.id])
    ).rows[0];
    if (!live?.active || live.password_hash !== user.passwordHash)
      fail(401, "INVALID_CREDENTIALS", "Username atau password salah.");
    await tx.query(
      "INSERT INTO auth_sessions(user_id,token_hash,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
      [user.id, digest(token), csrfToken],
    );
    return { user: await actorUser(live), token, csrfToken };
  });
}
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const bearer = !!req.headers.authorization?.startsWith("Bearer "),
      token = bearer
        ? req.headers.authorization!.slice(7)
        : req.cookies?.dc_session;
    if (!token) fail(401, "UNAUTHENTICATED", "Silakan login terlebih dahulu.");
    const row = (
      await pool.query(
        "SELECT u.*,s.id session_id,s.csrf_token FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active",
        [digest(token)],
      )
    ).rows[0];
    if (!row)
      fail(401, "UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (
      !bearer &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("X-CSRF-Token") !== row.csrf_token
    )
      fail(
        403,
        "CSRF_REJECTED",
        "Sesi formulir tidak valid. Muat ulang halaman.",
      );
    res.locals.actor = {
      ...(await actorUser(row)),
      sessionId: row.session_id,
      csrfToken: row.csrf_token,
      bearer,
    } satisfies Actor;
    next();
  } catch (error) {
    next(error);
  }
}
export function owner(actor: Actor) {
  if (actor.role !== "OWNER")
    fail(403, "FORBIDDEN", "Hanya owner yang dapat mengakses fitur ini.");
}
export async function branchScope(
  actor: Actor,
  branchId: string,
  tx: Tx | typeof pool = pool,
) {
  const branch = (
    await tx.query(
      "SELECT * FROM branches WHERE id=$1 AND business_id=$2 AND active FOR SHARE",
      [branchId, actor.businessId],
    )
  ).rows[0];
  if (!branch) fail(404, "NOT_FOUND", "Cabang tidak ditemukan.");
  if (
    actor.role === "CASHIER" &&
    !(
      await tx.query(
        "SELECT 1 FROM user_branches WHERE user_id=$1 AND branch_id=$2",
        [actor.id, branchId],
      )
    ).rowCount
  )
    fail(403, "FORBIDDEN", "Cabang ini bukan penugasan Anda.");
  return branch;
}
export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  resourceId: string,
  detail: unknown = {},
) {
  await tx.query(
    "INSERT INTO audit_events(business_id,actor_id,action,resource_id,detail) VALUES ($1,$2,$3,$4,$5)",
    [actor.businessId, actor.id, action, resourceId, JSON.stringify(detail)],
  );
}
export async function idempotent<T>(
  actor: Actor,
  operation: string,
  key: string | undefined,
  payload: unknown,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!key || key.length < 8 || key.length > 128)
    fail(400, "IDEMPOTENCY_REQUIRED", "Kunci operasi harus 8–128 karakter.");
  const payloadHash = digest(JSON.stringify(payload));
  return transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${actor.id}|${operation}|${key}`,
    ]);
    const live = (
      await tx.query(
        "SELECT u.active,s.revoked_at,s.expires_at FROM app_users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.id=$1 AND u.id=$2 FOR SHARE OF u,s",
        [actor.sessionId, actor.id],
      )
    ).rows[0];
    if (
      !live?.active ||
      live.revoked_at ||
      new Date(live.expires_at) <= new Date()
    )
      fail(401, "UNAUTHENTICATED", "Sesi telah dicabut.");
    const old = (
      await tx.query(
        "SELECT * FROM idempotency_keys WHERE actor_id=$1 AND operation=$2 AND key=$3",
        [actor.id, operation, key],
      )
    ).rows[0];
    if (old) {
      if (old.payload_hash !== payloadHash)
        fail(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Kunci operasi sudah dipakai untuk data berbeda.",
        );
      return old.response as T;
    }
    const result = await work(tx);
    await tx.query(
      "INSERT INTO idempotency_keys(actor_id,operation,key,payload_hash,response) VALUES ($1,$2,$3,$4,$5)",
      [actor.id, operation, key, payloadHash, JSON.stringify(result)],
    );
    return result;
  });
}
