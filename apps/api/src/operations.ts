import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { pool, transaction, type Tx } from "@dc/db";
import {
  staffSchema,
  branchSchema,
  productSchema,
  recipeSchema,
  componentSchema,
  MONEY,
  id,
} from "@dc/contracts";
import { z } from "zod";
import { audit, owner, branchScope, type Actor } from "./auth";
import { D, lockBalances, move, type Component } from "./stock";
import { fail } from "./errors";
export async function saveStaff(actor: Actor, body: unknown, userId?: string) {
  owner(actor);
  const data = staffSchema.parse(body);
  if (!userId && !data.password)
    fail(400, "VALIDATION_ERROR", "Password wajib untuk staf baru.");
  return transaction(async (tx) => {
    const branchIds = [...new Set(data.branches)].sort();
    for (const branch of branchIds) await branchScope(actor, branch, tx);
    let user: any;
    if (userId) {
      user = (
        await tx.query(
          "SELECT * FROM app_users WHERE id=$1 AND business_id=$2 AND role='CASHIER' FOR UPDATE",
          [userId, actor.businessId],
        )
      ).rows[0];
      if (!user) fail(404, "NOT_FOUND", "Staf tidak ditemukan.");
      const previous = (
        await tx.query(
          "SELECT branch_id FROM user_branches WHERE user_id=$1 ORDER BY branch_id",
          [userId],
        )
      ).rows.map((r) => r.branch_id);
      if (
        (!data.active ||
          JSON.stringify(previous) !== JSON.stringify(branchIds)) &&
        (
          await tx.query(
            "SELECT 1 FROM shifts WHERE cashier_id=$1 AND closed_at IS NULL",
            [userId],
          )
        ).rowCount
      )
        fail(
          409,
          "SHIFT_OPEN",
          "Tutup shift staf sebelum mengubah penugasan atau menonaktifkan akun.",
        );
      await tx.query(
        "UPDATE app_users SET name=$2,username=$3,password_hash=$4,active=$5 WHERE id=$1",
        [
          userId,
          data.name,
          data.username,
          data.password ? await hash(data.password) : user.password_hash,
          data.active,
        ],
      );
      // Any account edit revokes cached credentials/assignments on all devices.
      await tx.query(
        "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [userId],
      );
      await tx.query("DELETE FROM user_branches WHERE user_id=$1", [userId]);
    } else
      userId = (
        await tx.query(
          "INSERT INTO app_users(business_id,name,username,password_hash,role,active) VALUES ($1,$2,$3,$4,'CASHIER',$5) RETURNING id",
          [
            actor.businessId,
            data.name,
            data.username,
            await hash(data.password!),
            data.active,
          ],
        )
      ).rows[0].id;
    for (const branch of branchIds)
      await tx.query("INSERT INTO user_branches VALUES ($1,$2)", [
        userId,
        branch,
      ]);
    await audit(tx, actor, user ? "STAFF_UPDATED" : "STAFF_CREATED", userId!, {
      username: data.username,
      branches: branchIds,
      active: data.active,
      passwordChanged: !!data.password,
    });
    return { id: userId };
  });
}
export async function saveBranch(
  actor: Actor,
  body: unknown,
  branchId?: string,
) {
  owner(actor);
  const data = branchSchema.parse(body);
  return transaction(async (tx) => {
    if (branchId) {
      if (
        !(
          await tx.query(
            "SELECT 1 FROM branches WHERE id=$1 AND business_id=$2 FOR UPDATE",
            [branchId, actor.businessId],
          )
        ).rowCount
      )
        fail(404, "NOT_FOUND", "Cabang tidak ditemukan.");
      if (
        !data.active &&
        (
          await tx.query(
            "SELECT 1 FROM shifts WHERE branch_id=$1 AND closed_at IS NULL",
            [branchId],
          )
        ).rowCount
      )
        fail(409, "SHIFT_OPEN", "Tutup shift cabang terlebih dahulu.");
      await tx.query(
        "UPDATE branches SET name=$2,address=$3,active=$4 WHERE id=$1",
        [branchId, data.name, data.address, data.active],
      );
    } else {
      branchId = (
        await tx.query(
          "INSERT INTO branches(business_id,name,address,active) VALUES ($1,$2,$3,$4) RETURNING id",
          [actor.businessId, data.name, data.address, data.active],
        )
      ).rows[0].id;
      await tx.query(
        "INSERT INTO stock_balances(branch_id,item_id) SELECT $1,id FROM stock_items WHERE business_id=$2",
        [branchId, actor.businessId],
      );
    }
    await audit(tx, actor, "BRANCH_SAVED", branchId!, data);
    return { id: branchId };
  });
}
export async function saveProduct(
  actor: Actor,
  body: unknown,
  productId?: string,
) {
  owner(actor);
  const data = productSchema.parse(body);
  return transaction(async (tx) => {
    if (productId) {
      const old = (
        await tx.query(
          "SELECT id FROM products WHERE id=$1 AND business_id=$2 FOR UPDATE",
          [productId, actor.businessId],
        )
      ).rows[0];
      if (!old) fail(404, "NOT_FOUND", "Isian tidak ditemukan.");
      await tx.query(
        "UPDATE products SET name=$2,category=$3,potato_noodle_allowed=$4,active=$5,version=version+1 WHERE id=$1",
        [
          productId,
          data.name,
          data.category,
          data.category === "Gurih pedas" && data.potatoNoodleAllowed,
          data.active,
        ],
      );
      await tx.query("UPDATE skus SET active=false WHERE product_id=$1", [
        productId,
      ]);
    } else
      productId = (
        await tx.query(
          "INSERT INTO products(business_id,name,category,potato_noodle_allowed,active) VALUES ($1,$2,$3,$4,$5) RETURNING id",
          [
            actor.businessId,
            data.name,
            data.category,
            data.category === "Gurih pedas" && data.potatoNoodleAllowed,
            data.active,
          ],
        )
      ).rows[0].id;
    for (const [size, price] of Object.entries(data.prices))
      if (price)
        await tx.query(
          "INSERT INTO skus(product_id,size,price) VALUES ($1,$2,$3) ON CONFLICT(product_id,size) DO UPDATE SET price=$3,active=true",
          [productId, size, price],
        );
    await audit(tx, actor, "PRODUCT_SAVED", productId!, data);
    return { id: productId };
  });
}
async function componentsScope(tx: Tx, actor: Actor, components: Component[]) {
  const ids = [...new Set(components.map((c) => c.itemId))];
  if (ids.length !== components.length)
    fail(
      400,
      "DUPLICATE_COMPONENT",
      "Gabungkan bahan yang sama menjadi satu baris.",
    );
  if (
    (
      await tx.query(
        "SELECT id FROM stock_items WHERE business_id=$1 AND kind='RAW' AND id=ANY($2::uuid[])",
        [actor.businessId, ids],
      )
    ).rows.length !== ids.length
  )
    fail(
      400,
      "INVALID_COMPONENT",
      "Pilih bahan baku yang valid; subresep produk jadi belum didukung.",
    );
}
export async function saveRecipe(actor: Actor, body: unknown) {
  owner(actor);
  const data = recipeSchema.parse(body);
  return transaction(async (tx) => {
    await branchScope(actor, data.branchId, tx);
    await componentsScope(tx, actor, data.components);
    if (
      !(
        await tx.query(
          "SELECT s.id FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=$1 AND p.business_id=$2",
          [data.skuId, actor.businessId],
        )
      ).rowCount
    )
      fail(404, "NOT_FOUND", "SKU tidak ditemukan.");
    if (data.mode === "READY_STOCK") {
      if (
        !data.finishedItemId ||
        !(
          await tx.query(
            "SELECT 1 FROM stock_items WHERE id=$1 AND business_id=$2 AND kind='FINISHED'",
            [data.finishedItemId, actor.businessId],
          )
        ).rowCount
      )
        fail(
          400,
          "FINISHED_ITEM_REQUIRED",
          "Pilih produk jadi untuk mode siap jual.",
        );
      if (data.components.some((c) => c.itemId === data.finishedItemId))
        fail(
          400,
          "RECURSIVE_RECIPE",
          "Output tidak boleh menjadi bahan resep sendiri.",
        );
    }
    const row = (
      await tx.query(
        "INSERT INTO recipes(sku_id,branch_id,mode,finished_item_id,components) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(sku_id,branch_id) DO UPDATE SET mode=$3,finished_item_id=$4,components=$5,version=recipes.version+1 RETURNING id",
        [
          data.skuId,
          data.branchId,
          data.mode,
          data.finishedItemId,
          JSON.stringify(data.components),
        ],
      )
    ).rows[0];
    await audit(tx, actor, "RECIPE_SAVED", row.id, data);
    return row;
  });
}
export async function saveModifierRecipe(actor: Actor, body: unknown) {
  owner(actor);
  const data = z
    .object({
      modifierId: id,
      branchId: id,
      components: z.array(componentSchema).min(1),
    })
    .parse(body);
  return transaction(async (tx) => {
    await branchScope(actor, data.branchId, tx);
    await componentsScope(tx, actor, data.components);
    if (
      !(
        await tx.query(
          "SELECT 1 FROM modifiers WHERE id=$1 AND business_id=$2",
          [data.modifierId, actor.businessId],
        )
      ).rowCount
    )
      fail(404, "NOT_FOUND", "Topping tidak ditemukan.");
    await tx.query(
      "INSERT INTO modifier_recipes VALUES ($1,$2,$3) ON CONFLICT(modifier_id,branch_id) DO UPDATE SET components=$3",
      [data.modifierId, data.branchId, JSON.stringify(data.components)],
    );
    await audit(tx, actor, "MODIFIER_RECIPE_SAVED", data.modifierId);
    return { ok: true };
  });
}
export async function createItem(actor: Actor, body: unknown) {
  owner(actor);
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      unit: z.string().min(1).max(15),
      kind: z.enum(["RAW", "FINISHED"]),
    })
    .parse(body);
  return transaction(async (tx) => {
    const row = (
      await tx.query(
        "INSERT INTO stock_items(business_id,name,unit,kind) VALUES ($1,$2,$3,$4) RETURNING id",
        [actor.businessId, data.name, data.unit, data.kind],
      )
    ).rows[0];
    await tx.query(
      "INSERT INTO stock_balances(branch_id,item_id) SELECT id,$1 FROM branches WHERE business_id=$2",
      [row.id, actor.businessId],
    );
    await audit(tx, actor, "STOCK_ITEM_CREATED", row.id, data);
    return row;
  });
}
export const movementSchema = z.object({
  branchId: id,
  itemId: id,
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => Number(v) >= 0 && Number(v) <= 1e9),
  unitCost: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  targetBranchId: id.optional(),
  version: z.number().int().positive().optional(),
  note: z.string().trim().min(5).max(500),
  method: z.enum(["Tunai", "QRIS", "Transfer"]).default("Transfer"),
  shiftId: id.optional(),
});
async function cashSource(
  tx: Tx,
  actor: Actor,
  branchId: string,
  shiftId: string | undefined,
) {
  if (!shiftId) return null;
  const shift = (
    await tx.query("SELECT * FROM shifts WHERE id=$1 FOR UPDATE", [shiftId])
  ).rows[0];
  if (!shift || shift.closed_at || shift.branch_id !== branchId)
    fail(409, "SHIFT_CLOSED", "Shift sumber uang tidak aktif pada cabang ini.");
  if (actor.role !== "OWNER" && shift.cashier_id !== actor.id)
    fail(403, "FORBIDDEN", "Shift bukan milik Anda.");
  return shift.id;
}
export async function stockMovement(
  tx: Tx,
  actor: Actor,
  type: string,
  body: unknown,
) {
  owner(actor);
  const data = movementSchema.parse(body);
  await branchScope(actor, data.branchId, tx);
  if (type === "transfer") {
    if (!data.targetBranchId || data.targetBranchId === data.branchId)
      fail(400, "INVALID_TARGET", "Pilih cabang tujuan berbeda.");
    await branchScope(actor, data.targetBranchId, tx);
  }
  const shiftId =
    type === "receive" && data.method === "Tunai"
      ? await cashSource(tx, actor, data.branchId, data.shiftId)
      : null;
  const item = (
    await tx.query(
      "SELECT kind FROM stock_items WHERE id=$1 AND business_id=$2",
      [data.itemId, actor.businessId],
    )
  ).rows[0];
  if (!item) fail(404, "NOT_FOUND", "Item stok tidak ditemukan.");
  if (item.kind === "FINISHED" && !D(data.quantity).isInteger())
    fail(400, "INVALID_QUANTITY", "Jumlah produk jadi harus bilangan bulat.");
  const source = randomUUID();
  const branches = [
    data.branchId,
    ...(type === "transfer" ? [data.targetBranchId!] : []),
  ].sort();
  const all = new Map();
  for (const branch of branches)
    all.set(branch, await lockBalances(tx, branch, [data.itemId]));
  const balance = all.get(data.branchId).get(data.itemId);
  let qty = D(data.quantity);
  if (type === "count") {
    if (data.version !== balance.version)
      fail(
        409,
        "VERSION_CONFLICT",
        "Stok berubah setelah penghitungan. Hitung ulang.",
      );
    qty = qty.sub(balance.quantity);
  } else if (!qty.gt(0))
    fail(400, "INVALID_QUANTITY", "Jumlah harus lebih besar dari 0.");
  if (type === "waste" || type === "transfer") qty = qty.negated();
  if (qty.gt(0) && data.unitCost === undefined)
    fail(400, "COST_REQUIRED", "Biaya per satuan wajib untuk stok masuk.");
  const value = await move(
    tx,
    actor,
    balance,
    qty,
    type.toUpperCase(),
    source,
    data.note,
    qty.gt(0) ? qty.mul(data.unitCost!) : undefined,
  );
  if (type === "transfer")
    await move(
      tx,
      actor,
      all.get(data.targetBranchId).get(data.itemId),
      qty.abs(),
      "TRANSFER",
      source,
      data.note,
      value.abs(),
    );
  if (type === "receive")
    await tx.query(
      "INSERT INTO cash_movements(branch_id,shift_id,amount,kind,source_id) VALUES ($1,$2,$3,'PURCHASE',$4)",
      [
        data.branchId,
        shiftId,
        value.negated().toDecimalPlaces(0).toString(),
        source,
      ],
    );
  await audit(tx, actor, `STOCK_${type.toUpperCase()}`, source, data);
  return { id: source };
}
export async function production(tx: Tx, actor: Actor, body: unknown) {
  owner(actor);
  const data = z
    .object({
      recipeId: id,
      quantity: z.number().int().positive().max(10000),
      actual: z.number().int().positive().max(10000),
      note: z.string().min(5).max(500),
    })
    .parse(body);
  if (data.actual > data.quantity)
    fail(
      400,
      "INVALID_OUTPUT",
      "Hasil aktual tidak boleh melebihi jumlah rencana.",
    );
  const recipe = (
    await tx.query(
      "SELECT r.* FROM recipes r JOIN branches b ON b.id=r.branch_id WHERE r.id=$1 AND b.business_id=$2 FOR SHARE OF r",
      [data.recipeId, actor.businessId],
    )
  ).rows[0];
  if (!recipe || recipe.mode !== "READY_STOCK")
    fail(400, "INVALID_RECIPE", "Pilih resep produk siap jual.");
  await branchScope(actor, recipe.branch_id, tx);
  const components: Component[] = recipe.components;
  const balances = await lockBalances(tx, recipe.branch_id, [
    recipe.finished_item_id,
    ...components.map((c) => c.itemId),
  ]);
  const source = randomUUID();
  let value = D(0);
  for (const c of components)
    value = value.add(
      (
        await move(
          tx,
          actor,
          balances.get(c.itemId)!,
          D(c.quantity).mul(data.quantity).negated(),
          "PRODUCTION",
          source,
          data.note,
        )
      ).abs(),
    );
  await move(
    tx,
    actor,
    balances.get(recipe.finished_item_id)!,
    data.actual,
    "PRODUCTION",
    source,
    data.note,
    value,
  );
  await audit(tx, actor, "PRODUCTION", source, data);
  return { id: source };
}
export async function openShift(tx: Tx, actor: Actor, body: unknown) {
  if (actor.role !== "CASHIER")
    fail(403, "FORBIDDEN", "Shift hanya untuk akun kasir.");
  const data = z.object({ branchId: id, opening: MONEY }).parse(body);
  await branchScope(actor, data.branchId, tx);
  const row = (
    await tx.query(
      "INSERT INTO shifts(branch_id,cashier_id,opening) VALUES ($1,$2,$3) RETURNING id",
      [data.branchId, actor.id, data.opening],
    )
  ).rows[0];
  await audit(tx, actor, "SHIFT_OPEN", row.id, data);
  return row;
}
export async function expectedCash(tx: Tx | typeof pool, shift: any) {
  return (
    Number(shift.opening) +
    Number(
      (
        await tx.query(
          "SELECT COALESCE(sum(amount),0) total FROM cash_movements WHERE shift_id=$1",
          [shift.id],
        )
      ).rows[0].total,
    )
  );
}
export async function closeShift(
  tx: Tx,
  actor: Actor,
  shiftId: string,
  body: unknown,
) {
  const data = z.object({ actual: MONEY }).parse(body);
  const shift = (
    await tx.query("SELECT * FROM shifts WHERE id=$1 FOR UPDATE", [shiftId])
  ).rows[0];
  if (!shift) fail(404, "NOT_FOUND", "Shift tidak ditemukan.");
  await branchScope(actor, shift.branch_id, tx);
  if (actor.role !== "OWNER" && shift.cashier_id !== actor.id)
    fail(403, "FORBIDDEN", "Shift bukan milik Anda.");
  if (shift.closed_at) fail(409, "SHIFT_CLOSED", "Shift sudah ditutup.");
  const expected = await expectedCash(tx, shift);
  await tx.query(
    "UPDATE shifts SET actual=$2,difference=$3,closed_at=now() WHERE id=$1",
    [shiftId, data.actual, data.actual - expected],
  );
  await audit(tx, actor, "SHIFT_CLOSE", shiftId, { ...data, expected });
  return {
    id: shiftId,
    expected,
    actual: data.actual,
    difference: data.actual - expected,
  };
}
export async function expense(tx: Tx, actor: Actor, body: unknown) {
  owner(actor);
  const data = z
    .object({
      branchId: id,
      name: z.string().min(2).max(150),
      category: z.string().min(1).max(80),
      amount: MONEY.positive(),
      method: z.enum(["Tunai", "QRIS", "Transfer"]),
      shiftId: id.optional(),
    })
    .parse(body);
  await branchScope(actor, data.branchId, tx);
  const shiftId =
    data.method === "Tunai"
      ? await cashSource(tx, actor, data.branchId, data.shiftId)
      : null;
  const row = (
    await tx.query(
      "INSERT INTO expenses(branch_id,name,category,amount,method,actor_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        data.branchId,
        data.name,
        data.category,
        data.amount,
        data.method,
        actor.id,
      ],
    )
  ).rows[0];
  await tx.query(
    "INSERT INTO cash_movements(branch_id,shift_id,amount,kind,source_id) VALUES ($1,$2,$3,'OPEX',$4)",
    [data.branchId, shiftId, -data.amount, row.id],
  );
  await audit(tx, actor, "EXPENSE", row.id, data);
  return row;
}
export async function refund(
  tx: Tx,
  actor: Actor,
  orderId: string,
  body: unknown,
) {
  owner(actor);
  const data = z
    .object({
      reason: z.string().trim().min(5).max(500),
      method: z.enum(["Tunai", "QRIS", "Transfer"]),
      reference: z.string().trim().min(1).max(150),
      shiftId: id.optional(),
      restock: z.array(componentSchema).default([]),
    })
    .parse(body);
  const order = (
    await tx.query(
      "SELECT * FROM orders WHERE id=$1 AND business_id=$2 FOR UPDATE",
      [orderId, actor.businessId],
    )
  ).rows[0];
  if (!order) fail(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
  if (
    (await tx.query("SELECT 1 FROM refunds WHERE order_id=$1", [orderId]))
      .rowCount
  )
    fail(409, "ALREADY_REFUNDED", "Transaksi sudah direfund.");
  const shiftId =
    data.method === "Tunai"
      ? await cashSource(tx, actor, order.branch_id, data.shiftId)
      : null;
  const source = randomUUID();
  let recovered = D(0);
  const original = (
    await tx.query(
      "SELECT item_id,sum(-quantity_delta) qty,sum(-value_delta) value FROM stock_ledger WHERE source_type='SALE' AND source_id=$1 GROUP BY item_id",
      [orderId],
    )
  ).rows;
  if (new Set(data.restock.map((c) => c.itemId)).size !== data.restock.length)
    fail(400, "DUPLICATE_COMPONENT", "Bahan restock duplikat.");
  const balances = await lockBalances(
    tx,
    order.branch_id,
    data.restock.map((c) => c.itemId),
  );
  for (const component of data.restock) {
    const used = original.find((r) => r.item_id === component.itemId);
    if (!used || D(component.quantity).gt(used.qty))
      fail(400, "INVALID_RESTOCK", "Jumlah pemulihan melebihi pemakaian asli.");
    const value = D(used.value)
      .mul(component.quantity)
      .div(used.qty)
      .toDecimalPlaces(4);
    await move(
      tx,
      actor,
      balances.get(component.itemId)!,
      component.quantity,
      "REFUND",
      source,
      data.reason,
      value,
    );
    recovered = recovered.add(value);
  }
  await tx.query(
    "INSERT INTO refunds(id,order_id,amount,reason,method,reference,recovered_cost,actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      source,
      orderId,
      order.total,
      data.reason,
      data.method,
      data.reference,
      recovered.toFixed(4),
      actor.id,
    ],
  );
  await tx.query(
    "INSERT INTO cash_movements(branch_id,shift_id,amount,kind,source_id) VALUES ($1,$2,$3,'REFUND',$4)",
    [order.branch_id, shiftId, -Number(order.total), source],
  );
  await tx.query(
    "UPDATE orders SET status=CASE WHEN status='Antrean' THEN 'Dibatalkan' ELSE status END WHERE id=$1",
    [orderId],
  );
  await audit(tx, actor, "REFUND", source, { orderId, ...data });
  return { id: source, orderId };
}
export async function reverseExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
  body: unknown,
) {
  owner(actor);
  const data = z
    .object({ reason: z.string().trim().min(5).max(500) })
    .parse(body);
  const row = (
    await tx.query(
      "SELECT e.* FROM expenses e JOIN branches b ON b.id=e.branch_id WHERE e.id=$1 AND b.business_id=$2 FOR UPDATE OF e",
      [expenseId, actor.businessId],
    )
  ).rows[0];
  if (!row) fail(404, "NOT_FOUND", "Pengeluaran tidak ditemukan.");
  if (row.reversed_at)
    fail(409, "ALREADY_REVERSED", "Pengeluaran sudah dikoreksi.");
  await tx.query("UPDATE expenses SET reversed_at=now() WHERE id=$1", [
    expenseId,
  ]);
  // A closed drawer is never edited retroactively. The reversal is external business cash.
  await tx.query(
    "INSERT INTO cash_movements(branch_id,amount,kind,source_id) VALUES ($1,$2,'OPEX_REVERSAL',$3)",
    [row.branch_id, row.amount, expenseId],
  );
  await audit(tx, actor, "EXPENSE_REVERSED", expenseId, data);
  return { id: expenseId };
}
