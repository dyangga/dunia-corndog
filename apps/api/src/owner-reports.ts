import { pool } from "@dc/db";
import { owner, branchScope, type Actor } from "./auth";
import { ownerOrder, reports } from "./queries";
import type { OwnerOrderPage, ReportOverview } from "@dc/contracts";

const orderColumns = `SELECT o.*,u.name cashier_name,b.name branch_name,r.id refund_id,r.reason refund_reason,r.created_at refund_date,r.recovered_cost
 FROM orders o JOIN app_users u ON u.id=o.cashier_id JOIN branches b ON b.id=o.branch_id LEFT JOIN refunds r ON r.order_id=o.id`;
const orderFilter = `o.business_id=$1 AND o.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Jakarta')
 AND o.created_at < (($3::date+1)::timestamp AT TIME ZONE 'Asia/Jakarta') AND ($4::uuid IS NULL OR o.branch_id=$4)
 AND ($5='Semua' OR ($5='Refund' AND r.id IS NOT NULL) OR o.method=$5)
 AND position(lower($6) in lower(concat('DC-',lpad(o.number::text,6,'0'),' ',o.id::text,' ',u.name,' ',b.name)))>0`;
export async function ownerOrders(
  actor: Actor,
  from: string,
  to: string,
  branchId?: string,
  method = "Semua",
  search = "",
  cursor?: string,
  limit = 25,
): Promise<OwnerOrderPage> {
  owner(actor);
  if (branchId) await branchScope(actor, branchId);
  const rows = (
    await pool.query(
      `${orderColumns} WHERE ${orderFilter} AND ($7::bigint IS NULL OR o.number<$7) ORDER BY o.number DESC LIMIT $8`,
      [
        actor.businessId,
        from,
        to,
        branchId || null,
        method,
        search,
        cursor || null,
        limit + 1,
      ],
    )
  ).rows;
  return {
    items: rows.slice(0, limit).map(ownerOrder),
    nextCursor: rows.length > limit ? String(rows[limit - 1].number) : null,
  };
}
export async function ownerOrderDetail(actor: Actor, id: string) {
  owner(actor);
  const row = (
    await pool.query(`${orderColumns} WHERE o.business_id=$1 AND o.id=$2`, [
      actor.businessId,
      id,
    ])
  ).rows[0];
  return row ? ownerOrder(row) : null;
}

export async function reportOverview(
  actor: Actor,
  from: string,
  to: string,
  branchId?: string,
): Promise<ReportOverview> {
  owner(actor);
  if (branchId) await branchScope(actor, branchId);
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const args = [actor.businessId, from, to, branchId || null];
    // Sale and refund are independent dated events, including refunds of older sales.
    const events = `WITH events AS (
      SELECT o.created_at,o.branch_id,o.method,o.lines,o.total gross,0::bigint refunds,false refunded,o.status
      FROM orders o WHERE o.business_id=$1
      UNION ALL
      SELECT r.created_at,o.branch_id,r.method,o.lines,0::bigint,r.amount,true,o.status
      FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.business_id=$1
    ), scoped AS (SELECT * FROM events WHERE created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND created_at < (($3::date+1)::timestamp AT TIME ZONE 'Asia/Jakarta') AND ($4::uuid IS NULL OR branch_id=$4))`;
    const totals = await reports(actor, from, to, branchId, db);
    const daily = (
      await db.query(
        `${events} SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date::text date,sum(gross)::float8 gross,sum(refunds)::float8 refunds,(sum(gross)-sum(refunds))::float8 net FROM scoped GROUP BY 1 ORDER BY 1`,
        args,
      )
    ).rows;
    const payments = (
      await db.query(
        `${events} SELECT method,count(*) FILTER(WHERE NOT refunded)::int count,count(*) FILTER(WHERE refunded)::int "refundCount",sum(gross)::float8 gross,sum(refunds)::float8 refunds,(sum(gross)-sum(refunds))::float8 net FROM scoped GROUP BY method ORDER BY method`,
        args,
      )
    ).rows;
    const branches = (
      await db.query(
        `${events} SELECT branch_id id,sum(gross)::float8 gross,sum(refunds)::float8 refunds,(sum(gross)-sum(refunds))::float8 net,count(*) FILTER(WHERE NOT refunded)::int count,count(*) FILTER(WHERE NOT refunded AND status='Selesai')::int completed FROM scoped GROUP BY branch_id`,
        args,
      )
    ).rows;
    const products = (
      await db.query(
        `${events} SELECT l->>'productId' "productId",l->>'name' name,l->>'category' category,l->>'size' size,
      COALESCE(sum((l->>'qty')::numeric) FILTER(WHERE NOT refunded),0)::float8 sold,
      COALESCE(sum((l->>'qty')::numeric) FILTER(WHERE refunded),0)::float8 refunded,
      COALESCE(sum((l->>'qty')::numeric*(l->>'price')::numeric) FILTER(WHERE NOT refunded),0)::float8 gross,
      COALESCE(sum((l->>'qty')::numeric*(l->>'price')::numeric) FILTER(WHERE refunded),0)::float8 refunds
      FROM scoped CROSS JOIN LATERAL jsonb_array_elements(lines) l GROUP BY 1,2,3,4 ORDER BY sold DESC,name,size`,
        args,
      )
    ).rows;
    const modifiers = (
      await db.query(
        `${events}, expanded AS (
      SELECT refunded,(l->>'qty')::numeric qty,l FROM scoped CROSS JOIN LATERAL jsonb_array_elements(lines) l
    ), choices AS (
      SELECT refunded,qty,name,'Gratis' kind FROM expanded CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(l->'toppings','[]'::jsonb)) name
      UNION ALL SELECT refunded,qty,name,'Berbayar' FROM expanded CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(l->'extraToppings','[]'::jsonb)) name
    ) SELECT name,kind,COALESCE(sum(qty) FILTER(WHERE NOT refunded),0)::float8 sold,COALESCE(sum(qty) FILTER(WHERE refunded),0)::float8 refunded FROM choices GROUP BY name,kind ORDER BY sold DESC,name`,
        args,
      )
    ).rows;
    const recent = (
      await db.query(
        `${orderColumns} WHERE ${orderFilter} ORDER BY o.number DESC LIMIT 4`,
        [...args, "Semua", ""],
      )
    ).rows;
    const expenseStats = (
      await db.query(
        `SELECT count(*)::int count,count(DISTINCT e.category)::int categories FROM cash_movements c JOIN expenses e ON e.id=c.source_id JOIN branches b ON b.id=c.branch_id WHERE b.business_id=$1 AND c.kind IN ('OPEX','OPEX_REVERSAL') AND c.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Jakarta') AND c.created_at < (($3::date+1)::timestamp AT TIME ZONE 'Asia/Jakarta') AND ($4::uuid IS NULL OR c.branch_id=$4)`,
        args,
      )
    ).rows[0];
    await db.query("COMMIT");
    return {
      totals,
      expenseStats,
      daily,
      payments,
      products,
      modifiers,
      branches,
      recentOrders: recent.map(ownerOrder),
    };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
