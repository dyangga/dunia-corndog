import { z } from "zod";
import { pool } from "@dc/db";
import { branchScope, owner, type Actor } from "./auth";
import { fail } from "./errors";
import { businessDate } from "./queries";

function decode(cursor?: string): [string, string] | null {
  if (!cursor) return null;
  try {
    return z
      .tuple([z.iso.datetime(), z.string().min(1).max(100)])
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    fail(400, "INVALID_CURSOR", "Cursor tidak valid.");
  }
}
const stamp = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
function page<T>(rows: any[], limit: number, map: (r: any) => T) {
  const last = rows[limit - 1];
  return {
    items: rows.slice(0, limit).map(map),
    nextCursor:
      rows.length > limit
        ? Buffer.from(
            JSON.stringify([last.cursor_time, last.cursor_id]),
          ).toString("base64url")
        : null,
  };
}
export async function ownerExpenses(
  actor: Actor,
  from: string,
  to: string,
  branch?: string,
  cursor?: string,
  limit = 25,
) {
  owner(actor);
  if (branch) await branchScope(actor, branch);
  const after = decode(cursor);
  const rows = (
    await pool.query(
      `WITH events AS (
    SELECT e.*,e.id::text event_id,e.created_at event_at,e.amount event_amount,e.name event_name FROM expenses e
    UNION ALL SELECT e.*,e.id::text||'-reversal',e.reversed_at,-e.amount,'Koreksi: '||e.name FROM expenses e WHERE e.reversed_at IS NOT NULL
  ) SELECT e.*,${stamp("e.event_at")} cursor_time,e.event_id cursor_id FROM events e JOIN branches b ON b.id=e.branch_id
    WHERE b.business_id=$1 AND e.event_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Jakarta') AND e.event_at < (($3::date+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND ($4::uuid IS NULL OR e.branch_id=$4) AND ($5::timestamptz IS NULL OR (e.event_at,e.event_id)<($5::timestamptz,$6::text))
    ORDER BY e.event_at DESC,e.event_id DESC LIMIT $7`,
      [
        actor.businessId,
        from,
        to,
        branch || null,
        after?.[0] || null,
        after?.[1] || null,
        limit + 1,
      ],
    )
  ).rows;
  return page(rows, limit, (r) => ({
    id: r.event_id,
    originalId: r.id,
    name: r.event_name,
    category: r.category,
    amount: Number(r.event_amount),
    branch: r.branch_id,
    date: businessDate(r.event_at),
    method: r.method,
    reversed: !!r.reversed_at,
  }));
}
export async function ownerShifts(
  actor: Actor,
  branch?: string,
  state = "all",
  cursor?: string,
  limit = 25,
) {
  owner(actor);
  if (branch) await branchScope(actor, branch);
  const after = decode(cursor);
  if (after) z.uuid().parse(after[1]);
  const rows = (
    await pool.query(
      `SELECT s.*,u.name cashier_name,${stamp("s.opened_at")} cursor_time,s.id::text cursor_id
    FROM shifts s JOIN app_users u ON u.id=s.cashier_id WHERE u.business_id=$1 AND ($2::uuid IS NULL OR s.branch_id=$2)
    AND ($3='all' OR ($3='active' AND s.closed_at IS NULL) OR ($3='closed' AND s.closed_at IS NOT NULL))
    AND ($4::timestamptz IS NULL OR (s.opened_at,s.id)<($4::timestamptz,$5::uuid))
    ORDER BY s.opened_at DESC,s.id DESC LIMIT $6`,
      [
        actor.businessId,
        branch || null,
        state,
        after?.[0] || null,
        after?.[1] || null,
        limit + 1,
      ],
    )
  ).rows;
  return page(rows, limit, (r) => ({
    id: r.id,
    branch: r.branch_id,
    cashier: r.cashier_name,
    opening: Number(r.opening),
    open: !r.closed_at,
    ...(r.closed_at
      ? { actual: Number(r.actual), difference: Number(r.difference) }
      : {}),
  }));
}
