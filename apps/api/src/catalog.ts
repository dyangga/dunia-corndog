import { pool, type Tx } from "@dc/db";
import type { Catalog, CheckoutInput, PublicOrder } from "@dc/contracts";
import { branchScope, audit, type Actor } from "./auth";
import { fail } from "./errors";
import { D, lockBalances, move, sumComponents, type Component } from "./stock";
import { randomUUID } from "node:crypto";
export async function catalog(
  actor: Actor,
  branchId: string,
): Promise<Catalog> {
  await branchScope(actor, branchId);
  const products = (
    await pool.query(
      "SELECT * FROM products WHERE business_id=$1 AND active ORDER BY category,name",
      [actor.businessId],
    )
  ).rows;
  const stocks = new Map(
    (
      await pool.query(
        "SELECT item_id,quantity FROM stock_balances WHERE branch_id=$1",
        [branchId],
      )
    ).rows.map((r) => [r.item_id, Number(r.quantity)]),
  );
  const skuRows = (
    await pool.query(
      "SELECT s.*,r.mode,r.finished_item_id,r.components FROM skus s JOIN products p ON p.id=s.product_id LEFT JOIN recipes r ON r.sku_id=s.id AND r.branch_id=$1 WHERE p.business_id=$2 AND s.active",
      [branchId, actor.businessId],
    )
  ).rows;
  const modifiers = (
    await pool.query(
      "SELECT id,name,category,kind,price FROM modifiers WHERE business_id=$1 AND active ORDER BY kind,name",
      [actor.businessId],
    )
  ).rows.map((m) => ({ ...m, price: Number(m.price) }));
  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      potatoNoodleAllowed: p.potato_noodle_allowed,
      skus: skuRows
        .filter((s) => s.product_id === p.id)
        .map((s) => {
          const components: Component[] =
            s.mode === "READY_STOCK"
              ? [{ itemId: s.finished_item_id, quantity: "1" }]
              : s.components || [];
          const available = components.length
            ? Math.min(
                ...components.map((c) =>
                  Math.floor((stocks.get(c.itemId) || 0) / Number(c.quantity)),
                ),
              )
            : 0;
          return { id: s.id, size: s.size, price: Number(s.price), available };
        }),
    })),
    modifiers,
    version: products.map((p) => `${p.id}:${p.version}`).join("|"),
  };
}
export function publicOrder(row: any): PublicOrder {
  return {
    id: row.id,
    number: `DC-${String(row.number).padStart(6, "0")}`,
    branchId: row.branch_id,
    cashier: row.cashier_name,
    shiftId: row.shift_id,
    lines: row.lines.map((l: any) => ({
      name: l.name,
      size: l.size,
      category: l.category,
      quantity: l.qty,
      modifiers: [...l.toppings, ...l.extraToppings],
      note: l.note,
      unitPrice: l.price,
    })),
    total: Number(row.total),
    received: Number(row.received),
    method: row.method,
    status: row.status,
    refunded: !!row.refund_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
export async function checkout(tx: Tx, actor: Actor, input: CheckoutInput) {
  const shift = (
    await tx.query("SELECT * FROM shifts WHERE id=$1 FOR UPDATE", [
      input.shiftId,
    ])
  ).rows[0];
  if (!shift || shift.cashier_id !== actor.id)
    fail(403, "FORBIDDEN", "Shift bukan milik akun ini.");
  await branchScope(actor, shift.branch_id, tx);
  if (shift.closed_at) fail(409, "SHIFT_CLOSED", "Shift sudah ditutup.");
  const skuIds = [...new Set(input.lines.map((l) => l.skuId))].sort();
  await tx.query(
    "SELECT p.id FROM products p JOIN skus s ON s.product_id=p.id WHERE s.id=ANY($1::uuid[]) AND p.business_id=$2 ORDER BY p.id FOR SHARE OF p",
    [skuIds, actor.businessId],
  );
  const skuRows = (
    await tx.query(
      "SELECT s.*,p.name,p.category,p.potato_noodle_allowed,p.active product_active FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=ANY($1::uuid[]) AND p.business_id=$2 ORDER BY s.id FOR SHARE OF s",
      [skuIds, actor.businessId],
    )
  ).rows;
  const recipes = (
    await tx.query(
      "SELECT * FROM recipes WHERE branch_id=$1 AND sku_id=ANY($2::uuid[]) ORDER BY sku_id FOR SHARE",
      [shift.branch_id, skuIds],
    )
  ).rows;
  const modifiers = (
    await tx.query(
      "SELECT * FROM modifiers WHERE business_id=$1 AND active ORDER BY id FOR SHARE",
      [actor.businessId],
    )
  ).rows;
  const modifierRecipes = (
    await tx.query(
      "SELECT * FROM modifier_recipes WHERE branch_id=$1 ORDER BY modifier_id FOR SHARE",
      [shift.branch_id],
    )
  ).rows;
  const lines: any[] = [];
  const usages: Component[][] = [];
  let total = 0;
  for (const line of input.lines) {
    const sku = skuRows.find((s) => s.id === line.skuId),
      recipe = recipes.find((r) => r.sku_id === line.skuId);
    if (!sku?.active || !sku.product_active || !recipe)
      fail(
        409,
        "MENU_UNAVAILABLE",
        "Isian atau resep tidak tersedia. Tinjau pesanan.",
      );
    const selected = line.modifierIds.map((id) =>
      modifiers.find((m) => m.id === id),
    );
    if (
      selected.some(
        (m) =>
          !m ||
          m.category !== sku.category ||
          (["Kentang", "Mie"].includes(m.name) && !sku.potato_noodle_allowed),
      )
    )
      fail(400, "INVALID_MODIFIER", "Topping tidak diizinkan untuk isian ini.");
    const base: Component[] =
      recipe.mode === "READY_STOCK"
        ? [{ itemId: recipe.finished_item_id, quantity: "1" }]
        : recipe.components;
    if (!base.length) fail(409, "RECIPE_REQUIRED", "Resep belum lengkap.");
    const perUnit: Component[] = [...base];
    for (const option of selected) {
      const component = modifierRecipes.find(
        (r) => r.modifier_id === option.id,
      );
      if (!component?.components.length)
        fail(409, "RECIPE_REQUIRED", "Resep topping belum lengkap.");
      perUnit.push(...component.components);
    }
    usages.push(
      perUnit.map((c) => ({
        ...c,
        quantity: D(c.quantity).mul(line.quantity).toString(),
      })),
    );
    const price =
      Number(sku.price) + selected.reduce((sum, m) => sum + Number(m.price), 0);
    total += price * line.quantity;
    lines.push({
      key: randomUUID(),
      productId: sku.product_id,
      skuId: sku.id,
      name: sku.name,
      size: sku.size,
      category: sku.category,
      coating: "Panir",
      toppings: selected
        .filter((m) => m.kind === "INCLUDED")
        .map((m) => m.name),
      extraToppings: selected
        .filter((m) => m.kind === "EXTRA")
        .map((m) => m.name),
      extra: 0,
      qty: line.quantity,
      price,
      cost: 0,
      note: line.note,
      recipeSnapshot: {
        mode: recipe.mode,
        version: recipe.version,
        components: perUnit,
      },
    });
  }
  if (!Number.isSafeInteger(total) || total <= 0)
    fail(400, "INVALID_TOTAL", "Total tidak valid.");
  if (total !== input.expectedTotal)
    fail(409, "PRICE_CHANGED", "Harga berubah. Tinjau ulang pesanan.", {
      total,
    });
  if (
    input.payment.method === "Tunai" &&
    (input.payment.cashReceived ?? 0) < total
  )
    fail(400, "INSUFFICIENT_CASH", "Uang diterima belum mencukupi.");
  if (input.payment.method !== "Tunai" && !input.payment.confirmed)
    fail(
      400,
      "PAYMENT_UNCONFIRMED",
      "Konfirmasikan penerimaan pembayaran manual.",
    );
  const combined = sumComponents(usages.flat()),
    balances = await lockBalances(tx, shift.branch_id, [...combined.keys()]);
  for (const [id, qty] of combined)
    if (D(balances.get(id)!.quantity).lt(qty))
      fail(
        409,
        "INSUFFICIENT_STOCK",
        "Stok berubah atau tidak mencukupi. Tinjau pesanan.",
      );
  const orderId = randomUUID();
  let cost = D(0);
  for (let i = 0; i < lines.length; i++) {
    let lineCost = D(0);
    for (const [id, qty] of sumComponents(usages[i]))
      lineCost = lineCost.add(
        (
          await move(
            tx,
            actor,
            balances.get(id)!,
            qty.negated(),
            "SALE",
            orderId,
          )
        ).abs(),
      );
    lines[i].cost = lineCost.div(lines[i].qty).toNumber();
    cost = cost.add(lineCost);
  }
  const row = (
    await tx.query(
      "INSERT INTO orders(id,business_id,branch_id,cashier_id,shift_id,lines,total,cost,method,received) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [
        orderId,
        actor.businessId,
        shift.branch_id,
        actor.id,
        shift.id,
        JSON.stringify(lines),
        total,
        cost.toFixed(4),
        input.payment.method,
        input.payment.method === "Tunai" ? input.payment.cashReceived : total,
      ],
    )
  ).rows[0];
  await tx.query(
    "INSERT INTO payments(order_id,method,amount,reference,confirmed_by) VALUES ($1,$2,$3,$4,$5)",
    [orderId, input.payment.method, total, input.payment.reference, actor.id],
  );
  await tx.query(
    "INSERT INTO cash_movements(branch_id,shift_id,amount,kind,source_id) VALUES ($1,$2,$3,'SALE',$4)",
    [
      shift.branch_id,
      input.payment.method === "Tunai" ? shift.id : null,
      total,
      orderId,
    ],
  );
  await audit(tx, actor, "CHECKOUT", orderId, {
    total,
    branchId: shift.branch_id,
  });
  return publicOrder({ ...row, cashier_name: actor.name });
}
