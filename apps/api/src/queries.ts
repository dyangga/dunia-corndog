import { pool } from "@dc/db";
import { branchScope, owner, type Actor } from "./auth";
import { catalog, publicOrder } from "./catalog";
import { expectedCash } from "./operations";
import type { State } from "@dc/contracts";
export const businessDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const number = (v: any) => Number(v || 0);
export async function listOrders(
  actor: Actor,
  branchId: string,
  limit = 25,
  cursor?: string,
  activeOnly = false,
) {
  await branchScope(actor, branchId);
  const rows = (
    await pool.query(
      `SELECT o.*,u.name cashier_name,r.id refund_id FROM orders o JOIN app_users u ON u.id=o.cashier_id LEFT JOIN refunds r ON r.order_id=o.id WHERE o.branch_id=$1 AND ($4::boolean=false OR (r.id IS NULL AND o.status IN ('Antrean','Diproses','Siap'))) AND ($2::bigint IS NULL OR o.number<$2) ORDER BY o.number DESC LIMIT $3`,
      [branchId, cursor || null, Math.min(limit, 100) + 1, activeOnly],
    )
  ).rows;
  const hasNext = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(publicOrder),
    nextCursor: hasNext ? String(rows[limit - 1].number) : null,
  };
}
export async function getOrder(actor: Actor, orderId: string) {
  const row = (
    await pool.query(
      "SELECT o.*,u.name cashier_name,r.id refund_id FROM orders o JOIN app_users u ON u.id=o.cashier_id LEFT JOIN refunds r ON r.order_id=o.id WHERE o.id=$1 AND o.business_id=$2",
      [orderId, actor.businessId],
    )
  ).rows[0];
  if (!row) return null;
  await branchScope(actor, row.branch_id);
  return publicOrder(row);
}
export async function activeShift(actor: Actor) {
  const shift = (
    await pool.query(
      "SELECT * FROM shifts WHERE cashier_id=$1 AND closed_at IS NULL",
      [actor.id],
    )
  ).rows[0];
  if (!shift) return null;
  await branchScope(actor, shift.branch_id);
  return {
    id: shift.id,
    branchId: shift.branch_id,
    opening: number(shift.opening),
    expected: await expectedCash(pool, shift),
    openedAt: new Date(shift.opened_at).toISOString(),
  };
}
export async function inventory(actor: Actor, branchId: string) {
  await branchScope(actor, branchId);
  const rows = (
    await pool.query(
      "SELECT i.*,s.quantity,s.value,s.minimum,s.version FROM stock_items i JOIN stock_balances s ON s.item_id=i.id WHERE s.branch_id=$1 AND i.business_id=$2 ORDER BY i.name",
      [branchId, actor.businessId],
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    kind: r.kind,
    quantity: r.quantity,
    minimum: r.minimum,
    version: r.version,
    ...(actor.role === "OWNER"
      ? {
          value: r.value,
          unitCost: number(r.quantity)
            ? number(r.value) / number(r.quantity)
            : 0,
        }
      : {}),
  }));
}
export async function ownerState(actor: Actor): Promise<State> {
  owner(actor);
  const branchRows = (
    await pool.query(
      "SELECT * FROM branches WHERE business_id=$1 ORDER BY name",
      [actor.businessId],
    )
  ).rows;
  const allCatalogs = await Promise.all(
    branchRows.filter((b) => b.active).map((b) => catalog(actor, b.id)),
  );
  const productRows = (
    await pool.query(
      "SELECT * FROM products WHERE business_id=$1 ORDER BY category,name",
      [actor.businessId],
    )
  ).rows;
  const skuRows = (
    await pool.query(
      "SELECT s.* FROM skus s JOIN products p ON p.id=s.product_id WHERE p.business_id=$1 AND s.active",
      [actor.businessId],
    )
  ).rows;
  const staff = (
    await pool.query(
      "SELECT u.id,u.name,u.username,u.active,COALESCE(array_agg(ub.branch_id) FILTER(WHERE ub.branch_id IS NOT NULL),'{}') branches FROM app_users u LEFT JOIN user_branches ub ON ub.user_id=u.id WHERE u.business_id=$1 AND u.role='CASHIER' GROUP BY u.id ORDER BY u.name",
      [actor.businessId],
    )
  ).rows;
  const orders = (
    await pool.query(
      "SELECT o.*,u.name cashier_name,r.id refund_id,r.reason refund_reason,r.created_at refund_date,r.recovered_cost FROM orders o JOIN app_users u ON u.id=o.cashier_id LEFT JOIN refunds r ON r.order_id=o.id WHERE o.business_id=$1 ORDER BY o.number DESC LIMIT 25",
      [actor.businessId],
    )
  ).rows;
  const stocks = (
    await pool.query(
      "SELECT i.*,s.branch_id,s.quantity,s.value,s.minimum,s.version FROM stock_items i JOIN stock_balances s ON s.item_id=i.id WHERE i.business_id=$1 ORDER BY i.name",
      [actor.businessId],
    )
  ).rows;
  const shifts = (
    await pool.query(
      "SELECT s.*,u.name cashier_name FROM shifts s JOIN app_users u ON u.id=s.cashier_id WHERE u.business_id=$1 AND s.closed_at IS NULL ORDER BY s.opened_at DESC",
      [actor.businessId],
    )
  ).rows;
  const postings = (
    await pool.query(
      "SELECT l.*,i.name FROM stock_ledger l JOIN stock_items i ON i.id=l.item_id WHERE i.business_id=$1 ORDER BY l.created_at DESC LIMIT 500",
      [actor.businessId],
    )
  ).rows;
  return {
    business: (
      await pool.query("SELECT name FROM businesses WHERE id=$1", [
        actor.businessId,
      ])
    ).rows[0].name,
    branches: branchRows.map((b) => ({
      ...b,
      cashier:
        staff
          .filter((u) => u.branches.includes(b.id) && u.active)
          .map((u) => u.name)
          .join(", ") || "Belum ditugaskan",
    })),
    users: staff.map((u) => ({ ...u, branch: u.branches[0] || "" })),
    products: productRows.map((p) => {
      const skus = skuRows.filter((s) => s.product_id === p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        active: p.active,
        potatoNoodleAllowed: p.potato_noodle_allowed,
        prices: Object.fromEntries(skus.map((s) => [s.size, number(s.price)])),
        price: Math.min(...skus.map((s) => number(s.price))),
        cost: 0,
        stock: allCatalogs.reduce(
          (n, c) =>
            n +
            Math.max(
              0,
              ...(c.products
                .find((x) => x.id === p.id)
                ?.skus.map((s) => s.available) || []),
            ),
          0,
        ),
        color: p.category === "Manis" ? "choco" : "gold",
      };
    }),
    orders: orders.map(ownerOrder),
    stocks: stocks.map((s) => ({
      id: `${s.branch_id}:${s.id}`,
      itemId: s.id,
      version: s.version,
      name: s.name,
      unit: s.unit,
      category: s.kind === "RAW" ? "Bahan baku" : "Produk jadi",
      qty: number(s.quantity),
      min: number(s.minimum),
      cost: number(s.quantity) ? number(s.value) / number(s.quantity) : 0,
      branch: s.branch_id,
    })),
    shifts: shifts.map((s) => ({
      id: s.id,
      branch: s.branch_id,
      cashier: s.cashier_name,
      opening: number(s.opening),
      open: !s.closed_at,
      ...(s.closed_at
        ? { actual: number(s.actual), difference: number(s.difference) }
        : {}),
    })),
    expenses: [],
    postings: postings.map((p) => ({
      id: p.id,
      type:
        (
          {
            RECEIVE: "stock-in",
            TRANSFER: "transfer",
            PRODUCTION: "production",
            WASTE: "waste",
            COUNT: "count",
          } as Record<string, string>
        )[p.source_type] || p.source_type.toLowerCase(),
      item: p.name,
      qty: number(p.quantity_delta),
      branch: p.branch_id,
      date: businessDate(p.created_at),
      note: p.note,
    })),
  };
}
export async function reports(
  actor: Actor,
  from: string,
  to: string,
  branchId?: string,
  db: Pick<typeof pool, "query"> = pool,
) {
  owner(actor);
  if (branchId) await branchScope(actor, branchId);
  const args = [actor.businessId, from, to, branchId || null];
  const filter =
    "b.business_id=$1 AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR branch_id=$4)";
  const sales = (
    await db.query(
      `SELECT COALESCE(sum(total),0) gross,COALESCE(sum(cost),0) cogs,count(*) count FROM (SELECT o.* FROM orders o JOIN branches b ON b.id=o.branch_id WHERE ${filter.replaceAll("created_at", "o.created_at").replaceAll("branch_id=$4", "o.branch_id=$4")}) x`,
      args,
    )
  ).rows[0];
  const refunds = (
    await db.query(
      `SELECT COALESCE(sum(amount),0) amount,COALESCE(sum(recovered_cost),0) recovered FROM (SELECT r.* FROM refunds r JOIN orders o ON o.id=r.order_id JOIN branches b ON b.id=o.branch_id WHERE ${filter.replaceAll("created_at", "r.created_at").replaceAll("branch_id=$4", "o.branch_id=$4")}) x`,
      args,
    )
  ).rows[0];
  const expenses = (
    await db.query(
      `SELECT COALESCE(sum(amount),0) total FROM (SELECT c.* FROM cash_movements c JOIN branches b ON b.id=c.branch_id WHERE c.kind IN ('OPEX','OPEX_REVERSAL') AND ${filter.replaceAll("created_at", "c.created_at").replaceAll("branch_id=$4", "c.branch_id=$4")}) x`,
      args,
    )
  ).rows[0];
  const losses = (
    await db.query(
      `SELECT COALESCE(sum(-value_delta),0) total FROM (SELECT l.* FROM stock_ledger l JOIN branches b ON b.id=l.branch_id WHERE source_type IN ('WASTE','COUNT') AND value_delta<0 AND ${filter.replaceAll("created_at", "l.created_at").replaceAll("branch_id=$4", "l.branch_id=$4")}) x`,
      args,
    )
  ).rows[0];
  const cash = (
    await db.query(
      `SELECT COALESCE(sum(amount),0) total FROM (SELECT c.* FROM cash_movements c JOIN branches b ON b.id=c.branch_id WHERE ${filter.replaceAll("created_at", "c.created_at").replaceAll("branch_id=$4", "c.branch_id=$4")}) x`,
      args,
    )
  ).rows[0];
  const gross = number(sales.gross),
    refundAmount = number(refunds.amount),
    net = gross - refundAmount,
    cogs = number(sales.cogs) - number(refunds.recovered),
    opex = -number(expenses.total),
    stockLoss = number(losses.total);
  return {
    from,
    to,
    branchId: branchId || null,
    gross,
    refunds: refundAmount,
    net,
    cogs,
    opex,
    stockLoss,
    profit: net - cogs - opex - stockLoss,
    cashFlow: number(cash.total),
    count: number(sales.count),
  };
}

export function ownerOrder(o: any): State["orders"][number] {
  return {
    id: o.id,
    number: `DC-${String(o.number).padStart(6, "0")}`,
    branch: o.branch_id,
    date: businessDate(o.created_at),
    time: new Date(o.created_at).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashier: o.cashier_name,
    lines: o.lines,
    total: number(o.total),
    cost: number(o.cost),
    method: o.method,
    received: number(o.received),
    status: o.status,
    refunded: !!o.refund_id,
    refundReason: o.refund_reason,
    refundDate: o.refund_date ? businessDate(o.refund_date) : undefined,
    recoveredCost: number(o.recovered_cost),
  };
}
