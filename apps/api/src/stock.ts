import Decimal from "decimal.js";
import type { Tx } from "@dc/db";
import type { Actor } from "./auth";
import { fail } from "./errors";
export type Component = { itemId: string; quantity: string };
export type Balance = {
  branch_id: string;
  item_id: string;
  quantity: string;
  value: string;
  version: number;
};
export const D = (value: Decimal.Value) => new Decimal(value);
export async function lockBalances(
  tx: Tx,
  branchId: string,
  itemIds: string[],
): Promise<Map<string, Balance>> {
  const ids = [...new Set(itemIds)].sort();
  if (!ids.length) return new Map();
  const rows = (
    await tx.query(
      "SELECT * FROM stock_balances WHERE branch_id=$1 AND item_id=ANY($2::uuid[]) ORDER BY item_id FOR UPDATE",
      [branchId, ids],
    )
  ).rows;
  if (rows.length !== ids.length)
    fail(
      409,
      "STOCK_NOT_CONFIGURED",
      "Saldo stok belum dikonfigurasi untuk cabang ini.",
    );
  return new Map(rows.map((row) => [row.item_id, row]));
}
export async function move(
  tx: Tx,
  actor: Actor,
  balance: Balance,
  delta: Decimal.Value,
  type: string,
  sourceId: string,
  note = "",
  incomingValue?: Decimal.Value,
) {
  const quantity = D(balance.quantity),
    value = D(balance.value),
    change = D(delta);
  if (change.isNegative() && quantity.lt(change.abs()))
    fail(409, "INSUFFICIENT_STOCK", "Stok tidak mencukupi.");
  if (change.isPositive() && incomingValue === undefined)
    fail(400, "COST_REQUIRED", "Nilai biaya stok masuk wajib diisi.");
  const valueDelta = change.isNegative()
    ? quantity.eq(change.abs())
      ? value.negated()
      : value.mul(change).div(quantity).toDecimalPlaces(4)
    : D(incomingValue ?? 0).toDecimalPlaces(4);
  const nextQty = quantity.add(change),
    nextValue = value.add(valueDelta);
  if (nextQty.lt(0) || nextValue.lt(0))
    fail(
      409,
      "INSUFFICIENT_STOCK",
      "Stok atau nilai persediaan tidak mencukupi.",
    );
  await tx.query(
    "UPDATE stock_balances SET quantity=$3,value=$4,version=version+1 WHERE branch_id=$1 AND item_id=$2",
    [
      balance.branch_id,
      balance.item_id,
      nextQty.toFixed(3),
      nextValue.toFixed(4),
    ],
  );
  await tx.query(
    "INSERT INTO stock_ledger(branch_id,item_id,quantity_delta,value_delta,source_type,source_id,actor_id,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      balance.branch_id,
      balance.item_id,
      change.toFixed(3),
      valueDelta.toFixed(4),
      type,
      sourceId,
      actor.id,
      note,
    ],
  );
  balance.quantity = nextQty.toFixed(3);
  balance.value = nextValue.toFixed(4);
  balance.version++;
  return valueDelta;
}
export function sumComponents(components: Component[]) {
  const map = new Map<string, Decimal>();
  for (const c of components)
    map.set(c.itemId, (map.get(c.itemId) || D(0)).add(c.quantity));
  return map;
}
