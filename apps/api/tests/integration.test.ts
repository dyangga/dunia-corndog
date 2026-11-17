import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request, { type Response } from "supertest";
import { readFile, readdir } from "node:fs/promises";
import { pool } from "@dc/db";
import { seedDatabase } from "../../../packages/db/src/seed";
import { createApp } from "../src/app";
const app = createApp();
let owner: string, cashier: string, b1: string, b2: string;
const key = () => crypto.randomUUID();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const login = async (username: string, password: string) =>
  request(app)
    .post("/api/v1/auth/login")
    .send({ username, password, client: "native" });
beforeAll(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const migrationDir = new URL(
    "../../../packages/db/migrations/",
    import.meta.url,
  );
  for (const file of (await readdir(migrationDir))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await pool.query(await readFile(new URL(file, migrationDir), "utf8"));
  }
  await seedDatabase();
  owner = (await login("owner", "OwnerTest123!")).body.token;
  cashier = (await login("nadia", "KasirTest123!")).body.token;
  const branches = (await request(app).get("/api/v1/branches").set(auth(owner)))
    .body;
  b1 = branches.find((b: any) => b.name === "Dipatiukur").id;
  b2 = branches.find((b: any) => b.name === "Antapani").id;
});
afterAll(() => pool.end());
describe("Express + real PostgreSQL", () => {
  it("creates and edits cashier credentials, revokes sessions, and never exposes passwords", async () => {
    let r = await request(app)
      .post("/api/v1/staff")
      .set(auth(owner))
      .send({
        name: "Staf Uji",
        username: "staf.uji",
        password: "PasswordAwal123!",
        branches: [b1],
      });
    expect(r.status).toBe(201);
    const id = r.body.id;
    const session = await login("staf.uji", "PasswordAwal123!");
    expect(session.status).toBe(200);
    expect(JSON.stringify(session.body)).not.toContain("password");
    r = await request(app)
      .patch(`/api/v1/staff/${id}`)
      .set(auth(owner))
      .send({
        name: "Staf Baru",
        username: "staf.baru",
        password: "PasswordBaru123!",
        branches: [b1],
      });
    expect(r.status).toBe(200);
    expect(
      (await request(app).get("/api/v1/auth/me").set(auth(session.body.token)))
        .status,
    ).toBe(401);
    expect((await login("staf.uji", "PasswordAwal123!")).status).toBe(401);
    expect((await login("staf.baru", "PasswordBaru123!")).status).toBe(200);
    const staff = (await request(app).get("/api/v1/staff").set(auth(owner)))
      .body;
    expect(JSON.stringify(staff)).not.toMatch(/password|hash|token/i);
    const stored = (
      await pool.query("SELECT password_hash FROM app_users WHERE id=$1", [id])
    ).rows[0].password_hash;
    expect(stored.startsWith("$argon2id$")).toBe(true);
  });
  it("rejects cross-branch access and owner-only resources for cashiers", async () => {
    for (const path of [
      `/catalog?branchId=${b2}`,
      `/inventory?branchId=${b2}`,
      "/owner/state",
      "/staff",
      "/reports?from=2026-01-01&to=2026-12-31",
    ])
      expect(
        (
          await request(app)
            .get("/api/v1" + path)
            .set(auth(cashier))
        ).status,
      ).toBe(403);
    const inv = (
      await request(app)
        .get(`/api/v1/inventory?branchId=${b1}`)
        .set(auth(cashier))
    ).body;
    expect(JSON.stringify(inv)).not.toMatch(/unitCost|value|password_hash/);
  });
  it("requires CSRF for cookie-authenticated writes", async () => {
    const agent = request.agent(app);
    const session = await agent
      .post("/api/v1/auth/login")
      .send({ username: "owner", password: "OwnerTest123!", client: "web" });
    expect(session.body.token).toBeUndefined();
    expect(session.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(
      (await agent.post("/api/v1/branches").send({ name: "Cabang CSRF" }))
        .status,
    ).toBe(403);
    expect(
      (
        await agent
          .post("/api/v1/branches")
          .set("X-CSRF-Token", session.body.csrfToken)
          .send({ name: "Cabang CSRF" })
      ).status,
    ).toBe(201);
  });
  it("checks out size/filling/free/paid toppings once and snapshots prices", async () => {
    const shift = (
      await request(app)
        .post("/api/v1/shifts/open")
        .set(auth(cashier))
        .set("Idempotency-Key", key())
        .send({ branchId: b1, opening: 100000 })
    ).body;
    const catalog = (
      await request(app)
        .get(`/api/v1/catalog?branchId=${b1}`)
        .set(auth(cashier))
    ).body;
    const p = catalog.products.find(
        (p: any) => p.name === "Mozzarella" && p.category === "Gurih pedas",
      ),
      sku = p.skus[0];
    const modifiers = ["Saus tomat", "Kentang", "Saus keju"].map(
      (name) => catalog.modifiers.find((m: any) => m.name === name).id,
    );
    const body = {
      shiftId: shift.id,
      lines: [
        {
          skuId: sku.id,
          quantity: 2,
          modifierIds: modifiers,
          note: "Saus dipisah",
        },
      ],
      expectedTotal: 10000,
      payment: { method: "Tunai", cashReceived: 20000 },
    };
    const operation = key();
    const first = await request(app)
      .post("/api/v1/checkout")
      .set(auth(cashier))
      .set("Idempotency-Key", operation)
      .send(body);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.total).toBe(10000);
    expect(first.body.lines[0].modifiers).toContain("Kentang");
    expect(JSON.stringify(first.body)).not.toMatch(/cost|recipeSnapshot/);
    const retry = await request(app)
      .post("/api/v1/checkout")
      .set(auth(cashier))
      .set("Idempotency-Key", operation)
      .send(body);
    expect(retry.body.id).toBe(first.body.id);
    expect(
      (
        await pool.query("SELECT count(*) FROM payments WHERE order_id=$1", [
          first.body.id,
        ])
      ).rows[0].count,
    ).toBe("1");
    const changed = await request(app)
      .post("/api/v1/checkout")
      .set(auth(cashier))
      .set("Idempotency-Key", operation)
      .send({ ...body, expectedTotal: 11000 });
    expect(changed.status).toBe(409);
    const badPrice = await request(app)
      .post("/api/v1/checkout")
      .set(auth(cashier))
      .set("Idempotency-Key", key())
      .send({ ...body, expectedTotal: 1 });
    expect(badPrice.body.error.code).toBe("PRICE_CHANGED");
    const original = (
      await pool.query(
        "SELECT count(*) n FROM stock_ledger WHERE source_type='SALE' AND source_id=$1",
        [first.body.id],
      )
    ).rows[0].n;
    const refunded = await request(app)
      .post(`/api/v1/orders/${first.body.id}/refund`)
      .set(auth(owner))
      .set("Idempotency-Key", key())
      .send({
        reason: "Pesanan dibatalkan pelanggan",
        method: "Transfer",
        reference: "pengembalian-manual",
      });
    expect(refunded.status).toBe(200);
    expect(
      (
        await pool.query(
          "SELECT count(*) n FROM stock_ledger WHERE source_type='REFUND'",
        )
      ).rows[0].n,
    ).toBe("0");
    expect(Number(original)).toBeGreaterThan(0);
    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${first.body.id}/refund`)
          .set(auth(owner))
          .set("Idempotency-Key", key())
          .send({
            reason: "Refund kedua ditolak",
            method: "Transfer",
            reference: "dua",
          })
      ).status,
    ).toBe(409);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());
    const report = await request(app)
      .get(`/api/v1/reports?from=${day}&to=${day}&branchId=${b1}`)
      .set(auth(owner));
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body.gross).toBe(10000);
    expect(report.body.refunds).toBe(10000);
    expect(report.body.net).toBe(0);
    expect(report.body.cogs).toBeGreaterThan(0);
  });
  it("allows exactly one checkout when two cashiers buy the last filling", async () => {
    const second = (await login("staf.baru", "PasswordBaru123!")).body.token;
    const shift1 = (
      await request(app).get("/api/v1/shifts/current").set(auth(cashier))
    ).body;
    const shift2 = (
      await request(app)
        .post("/api/v1/shifts/open")
        .set(auth(second))
        .set("Idempotency-Key", key())
        .send({ branchId: b1, opening: 0 })
    ).body;
    const catalog = (
      await request(app)
        .get(`/api/v1/catalog?branchId=${b1}`)
        .set(auth(cashier))
    ).body;
    const sku = catalog.products.find((p: any) => p.name === "Sosis").skus[0];
    const recipe = (
      await pool.query(
        "SELECT components FROM recipes WHERE sku_id=$1 AND branch_id=$2",
        [sku.id, b1],
      )
    ).rows[0];
    const filling = recipe.components[2].itemId;
    await pool.query(
      "UPDATE stock_balances SET value=value/quantity,quantity=1 WHERE branch_id=$1 AND item_id=$2",
      [b1, filling],
    );
    const checkout = (token: string, shiftId: string) =>
      request(app)
        .post("/api/v1/checkout")
        .set(auth(token))
        .set("Idempotency-Key", key())
        .send({
          shiftId,
          lines: [{ skuId: sku.id, quantity: 1, modifierIds: [] }],
          expectedTotal: 3000,
          payment: { method: "Tunai", cashReceived: 3000 },
        });
    const results = await Promise.all([
      checkout(cashier, shift1.id),
      checkout(second, shift2.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (
        await pool.query(
          "SELECT quantity FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
          [b1, filling],
        )
      ).rows[0].quantity,
    ).toBe("0.000");
  });
  it("values receipts at moving average and keeps transfer/count postings atomic", async () => {
    const post = (path: string, body: object) =>
      request(app)
        .post("/api/v1" + path)
        .set(auth(owner))
        .set("Idempotency-Key", key())
        .send(body);
    const item = (
      await post("/inventory/items", {
        name: "Bahan uji biaya",
        unit: "pcs",
        kind: "RAW",
      })
    ).body.id;
    for (const unitCost of ["5000", "7000"])
      expect(
        (
          await post("/inventory/receive", {
            branchId: b1,
            itemId: item,
            quantity: "10",
            unitCost,
            note: "Pembelian bahan untuk pengujian",
          })
        ).status,
      ).toBe(200);
    let balance = (
      await pool.query(
        "SELECT * FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
        [b1, item],
      )
    ).rows[0];
    expect(balance.quantity).toBe("20.000");
    expect(balance.value).toBe("120000.0000");
    expect(
      (
        await post("/inventory/waste", {
          branchId: b1,
          itemId: item,
          quantity: "3",
          note: "Bahan rusak saat pengujian",
        })
      ).status,
    ).toBe(200);
    balance = (
      await pool.query(
        "SELECT * FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
        [b1, item],
      )
    ).rows[0];
    expect(balance.quantity).toBe("17.000");
    expect(balance.value).toBe("102000.0000");
    const stale = await post("/inventory/count", {
      branchId: b1,
      itemId: item,
      quantity: "100",
      version: balance.version - 1,
      note: "Hitung dengan versi lama",
    });
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");
    const before = (
      await pool.query(
        "SELECT sum(value) total FROM stock_balances WHERE item_id=$1",
        [item],
      )
    ).rows[0].total;
    expect(
      (
        await post("/inventory/transfer", {
          branchId: b1,
          targetBranchId: b2,
          itemId: item,
          quantity: "2",
          note: "Barang diterima cabang tujuan",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await pool.query(
          "SELECT sum(value) total FROM stock_balances WHERE item_id=$1",
          [item],
        )
      ).rows[0].total,
    ).toBe(before);
    const bad = await post("/inventory/transfer", {
      branchId: b1,
      targetBranchId: b2,
      itemId: item,
      quantity: "1000",
      note: "Transfer melebihi stok",
    });
    expect(bad.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(
      (
        await pool.query(
          "SELECT sum(value) total FROM stock_balances WHERE item_id=$1",
          [item],
        )
      ).rows[0].total,
    ).toBe(before);
    await expect(
      pool.query("UPDATE stock_ledger SET quantity_delta=0 WHERE item_id=$1", [
        item,
      ]),
    ).rejects.toThrow("immutable");
  });
  it("produces ready stock once, sells the output without consuming raw ingredients twice, and restores original cost", async () => {
    const post = (path: string, body: object, token = owner) =>
      request(app)
        .post("/api/v1" + path)
        .set(auth(token))
        .set("Idempotency-Key", key())
        .send(body);
    const raw = (
      await pool.query(
        "SELECT id FROM stock_items WHERE name='Bahan uji biaya'",
      )
    ).rows[0].id;
    const finished = (
      await post("/inventory/items", {
        name: "Corndog siap uji",
        unit: "pcs",
        kind: "FINISHED",
      })
    ).body.id;
    const product = (
      await post("/products", {
        name: "Menu siap uji",
        category: "Gurih pedas",
        prices: { Small: 25000 },
      })
    ).body.id;
    const sku = (
      await request(app).get("/api/v1/skus").set(auth(owner))
    ).body.find((s: any) => s.product_id === product);
    const recipe = await request(app)
      .put("/api/v1/recipes")
      .set(auth(owner))
      .send({
        skuId: sku.id,
        branchId: b1,
        mode: "READY_STOCK",
        finishedItemId: finished,
        components: [{ itemId: raw, quantity: "2" }],
      });
    expect(recipe.status).toBe(200);
    const produced = await post("/production", {
      recipeId: recipe.body.id,
      quantity: 3,
      actual: 2,
      note: "Output aktual dua dari rencana tiga",
    });
    expect(produced.status, JSON.stringify(produced.body)).toBe(200);
    const rawBefore = (
      await pool.query(
        "SELECT quantity FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
        [b1, raw],
      )
    ).rows[0].quantity;
    const fg = (
      await pool.query(
        "SELECT * FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
        [b1, finished],
      )
    ).rows[0];
    expect(fg.quantity).toBe("2.000");
    expect(fg.value).toBe("36000.0000");
    const shift = (
      await request(app).get("/api/v1/shifts/current").set(auth(cashier))
    ).body;
    const order = await post(
      "/checkout",
      {
        shiftId: shift.id,
        lines: [{ skuId: sku.id, quantity: 1, modifierIds: [] }],
        expectedTotal: 25000,
        payment: { method: "QRIS", confirmed: true },
      },
      cashier,
    );
    expect(order.status, JSON.stringify(order.body)).toBe(201);
    expect(
      (
        await pool.query(
          "SELECT quantity FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
          [b1, raw],
        )
      ).rows[0].quantity,
    ).toBe(rawBefore);
    expect(
      (await pool.query("SELECT cost FROM orders WHERE id=$1", [order.body.id]))
        .rows[0].cost,
    ).toBe("18000.0000");
    const refunded = await post(`/orders/${order.body.id}/refund`, {
      reason: "Produk belum dipakai dan dipulihkan",
      method: "Transfer",
      reference: "bukti-retur",
      restock: [{ itemId: finished, quantity: "1" }],
    });
    expect(refunded.status, JSON.stringify(refunded.body)).toBe(200);
    expect(
      (
        await pool.query(
          "SELECT value FROM stock_balances WHERE branch_id=$1 AND item_id=$2",
          [b1, finished],
        )
      ).rows[0].value,
    ).toBe("36000.0000");
  });
  it("reverses expenses without rewriting history and prevents checkout after shift close", async () => {
    const post = (path: string, body: object) =>
      request(app)
        .post("/api/v1" + path)
        .set(auth(owner))
        .set("Idempotency-Key", key())
        .send(body);
    const expense = await post("/expenses", {
      branchId: b1,
      name: "Biaya uji koreksi",
      category: "Utilitas",
      amount: 10000,
      method: "Transfer",
    });
    expect(expense.status).toBe(201);
    expect(
      (
        await post(`/expenses/${expense.body.id}/reverse`, {
          reason: "Salah pencatatan biaya uji",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(`/expenses/${expense.body.id}/reverse`, {
          reason: "Koreksi kedua ditolak",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await pool.query("SELECT amount FROM expenses WHERE id=$1", [
          expense.body.id,
        ])
      ).rows[0].amount,
    ).toBe("10000");
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());
    const summary = (
      await request(app)
        .get(`/api/v1/reports?from=${day}&to=${day}&branchId=${b1}`)
        .set(auth(owner))
    ).body;
    expect(summary.opex).toBe(0);
    const shift = (
      await request(app).get("/api/v1/shifts/current").set(auth(cashier))
    ).body;
    const closed = await request(app)
      .post(`/api/v1/shifts/${shift.id}/close`)
      .set(auth(cashier))
      .set("Idempotency-Key", key())
      .send({ actual: shift.expected });
    expect(closed.status).toBe(200);
    expect(closed.body.difference).toBe(0);
    const sku = (
      await request(app)
        .get(`/api/v1/catalog?branchId=${b1}`)
        .set(auth(cashier))
    ).body.products[0].skus[0];
    const after = await request(app)
      .post("/api/v1/checkout")
      .set(auth(cashier))
      .set("Idempotency-Key", key())
      .send({
        shiftId: shift.id,
        lines: [{ skuId: sku.id, quantity: 1, modifierIds: [] }],
        expectedTotal: sku.price,
        payment: { method: "Tunai", cashReceived: sku.price },
      });
    expect(after.body.error.code).toBe("SHIFT_CLOSED");
  });
  it("aggregates dated sales/refunds and paginates owner history without downloading all orders", async () => {
    const original = (
      await pool.query("SELECT * FROM orders ORDER BY number LIMIT 1")
    ).rows[0];
    expect(original).toBeTruthy();
    const lines = [
      {
        ...original.lines[0],
        qty: 1,
        price: 2000,
        toppings: ["Cokelat"],
        extraToppings: ["Keju parut"],
      },
    ];
    const ids = (
      await pool.query(
        `INSERT INTO orders(business_id,branch_id,cashier_id,shift_id,lines,total,cost,method,received,created_at)
      SELECT $1,$2,$3,$4,$5::jsonb,2000,0,'Tunai',2000,'2030-01-01T17:00:00Z'::timestamptz FROM generate_series(1,40) RETURNING id`,
        [
          original.business_id,
          b1,
          original.cashier_id,
          original.shift_id,
          JSON.stringify(lines),
        ],
      )
    ).rows;
    const old = (
      await pool.query(
        `INSERT INTO orders(business_id,branch_id,cashier_id,shift_id,lines,total,cost,method,received,created_at)
      VALUES($1,$2,$3,$4,$5::jsonb,2000,0,'Tunai',2000,'2030-01-01T00:00:00Z') RETURNING id`,
        [
          original.business_id,
          b1,
          original.cashier_id,
          original.shift_id,
          JSON.stringify(lines),
        ],
      )
    ).rows[0];
    for (const orderId of [ids[0].id, old.id])
      await pool.query(
        `INSERT INTO refunds(order_id,amount,reason,method,reference,actor_id,created_at) VALUES($1,2000,'Review lintas tanggal','Tunai','review',$2,'2030-01-02T17:00:00Z')`,
        [orderId, original.cashier_id],
      );
    const url =
      "/api/v1/reports/overview?from=2030-01-03&to=2030-01-03&branchId=" + b1;
    const overview = await request(app).get(url).set(auth(owner));
    expect(overview.status).toBe(200);
    expect(overview.body.totals).toMatchObject({
      gross: 0,
      refunds: 4000,
      net: -4000,
      count: 0,
    });
    expect(overview.body.daily).toEqual([
      { date: "2030-01-03", gross: 0, refunds: 4000, net: -4000 },
    ]);
    expect(overview.body.products[0]).toMatchObject({
      sold: 0,
      refunded: 2,
      gross: 0,
      refunds: 4000,
    });
    expect(overview.body.modifiers).toHaveLength(2);
    for (const m of overview.body.modifiers)
      expect(m).toMatchObject({ sold: 0, refunded: 2 });
    expect(overview.body.payments[0]).toMatchObject({
      method: "Tunai",
      count: 0,
      refundCount: 2,
      refunds: 4000,
      net: -4000,
    });
    const base =
      "/api/v1/owner/orders?from=2030-01-02&to=2030-01-02&branchId=" + b1;
    const first = await request(app).get(base).set(auth(owner));
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(25);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await request(app)
      .get(base + "&cursor=" + first.body.nextCursor)
      .set(auth(owner));
    expect(second.body.items).toHaveLength(15);
    expect(second.body.nextCursor).toBeNull();
    expect(
      new Set([...first.body.items, ...second.body.items].map((o) => o.id))
        .size,
    ).toBe(40);
    const state = await request(app)
      .get("/api/v1/owner/state")
      .set(auth(owner));
    expect(state.body.orders.length).toBeLessThanOrEqual(25);
    const sales = await request(app)
      .get(
        "/api/v1/reports/overview?from=2030-01-02&to=2030-01-02&branchId=" + b1,
      )
      .set(auth(owner));
    expect(sales.body.totals).toMatchObject({ gross: 80000, count: 40 });
    expect(
      sales.body.products.reduce(
        (n: number, p: { gross: number }) => n + p.gross,
        0,
      ),
    ).toBe(sales.body.totals.gross);
    const exported = await request(app)
      .get("/api/v1/orders/export?from=2030-01-02&to=2030-01-02&branchId=" + b1)
      .set(auth(owner));
    expect(exported.text.trim().split("\r\n")).toHaveLength(41);
    expect(
      (await request(app).get(base.replace(b1, b2)).set(auth(owner))).body
        .items,
    ).toHaveLength(0);
    expect((await request(app).get(url).set(auth(cashier))).status).toBe(403);
    expect((await request(app).get(base).set(auth(cashier))).status).toBe(403);
    const detail = await request(app)
      .get("/api/v1/owner/orders/" + old.id)
      .set(auth(owner));
    expect(detail.body.refundDate).toBe("2030-01-03");
    expect(detail.body.date).toBe("2030-01-01");
    await pool.query(
      `INSERT INTO orders(business_id,branch_id,cashier_id,shift_id,lines,total,cost,method,received,created_at)
      SELECT $1,$2,$3,$4,$5::jsonb,2000,0,'Tunai',2000,'2030-01-10T00:00:00Z'::timestamptz FROM generate_series(1,10000)`,
      [
        original.business_id,
        b1,
        original.cashier_id,
        original.shift_id,
        JSON.stringify(lines),
      ],
    );
    const large = await request(app)
      .get(
        "/api/v1/reports/overview?from=2030-01-10&to=2030-01-10&branchId=" + b1,
      )
      .set(auth(owner));
    expect(large.status).toBe(200);
    expect(large.body.totals).toMatchObject({ gross: 20000000, count: 10000 });
    expect(large.body.recentOrders).toHaveLength(4);
    const bounded = await request(app)
      .get("/api/v1/owner/state")
      .set(auth(owner));
    expect(bounded.body.orders).toHaveLength(25);
  });
  it("paginates expense events and shift history with stable timestamp cursors", async () => {
    const original = (await pool.query("SELECT * FROM orders LIMIT 1")).rows[0];
    const expenses = (
      await pool.query(
        `INSERT INTO expenses(branch_id,name,category,amount,method,actor_id,created_at)
      SELECT $1,'Biaya histori '||n,'Sewa',1000,'Transfer',$2,'2035-02-01T10:00:00.123456Z'::timestamptz FROM generate_series(1,70) n RETURNING id`,
        [b1, original.cashier_id],
      )
    ).rows;
    for (const expense of expenses)
      await pool.query(
        `INSERT INTO cash_movements(branch_id,amount,kind,source_id,created_at) VALUES($1,-1000,'OPEX',$2,'2035-02-01T10:00:00.123456Z')`,
        [b1, expense.id],
      );
    await pool.query(
      `UPDATE expenses SET reversed_at='2035-02-02T10:00:00.123456Z' WHERE id=$1`,
      [expenses[0].id],
    );
    await pool.query(
      `INSERT INTO cash_movements(branch_id,amount,kind,source_id,created_at) VALUES($1,1000,'OPEX_REVERSAL',$2,'2035-02-02T10:00:00.123456Z')`,
      [b1, expenses[0].id],
    );
    const base =
      "/api/v1/owner/expenses?from=2035-02-01&to=2035-02-01&branchId=" + b1;
    const expenseIds: string[] = [];
    let cursor: string | null = null;
    do {
      const response: Response = await request(app)
        .get(base + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""))
        .set(auth(owner));
      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeLessThanOrEqual(25);
      expenseIds.push(...response.body.items.map((e: any) => e.id));
      cursor = response.body.nextCursor;
    } while (cursor);
    expect(expenseIds).toHaveLength(70);
    expect(new Set(expenseIds).size).toBe(70);
    const correction = await request(app)
      .get(
        "/api/v1/owner/expenses?from=2035-02-02&to=2035-02-02&branchId=" + b1,
      )
      .set(auth(owner));
    expect(correction.body.items).toHaveLength(1);
    expect(correction.body.items[0]).toMatchObject({
      originalId: expenses[0].id,
      amount: -1000,
      date: "2035-02-02",
      reversed: true,
    });
    const stats = await request(app)
      .get(
        "/api/v1/reports/overview?from=2035-02-01&to=2035-02-01&branchId=" + b1,
      )
      .set(auth(owner));
    expect(stats.body.expenseStats).toEqual({ count: 70, categories: 1 });
    expect(stats.body.totals.opex).toBe(70000);
    const reversalStats = await request(app)
      .get(
        "/api/v1/reports/overview?from=2035-02-02&to=2035-02-02&branchId=" + b1,
      )
      .set(auth(owner));
    expect(reversalStats.body.expenseStats.count).toBe(1);
    expect(reversalStats.body.totals.opex).toBe(-1000);
    expect(
      (await request(app).get(base.replace(b1, b2)).set(auth(owner))).body
        .items,
    ).toHaveLength(0);
    expect((await request(app).get(base).set(auth(cashier))).status).toBe(403);
    expect(
      (
        await request(app)
          .get(base + "&cursor=invalid")
          .set(auth(owner))
      ).status,
    ).toBe(400);
    await pool.query(
      `INSERT INTO shifts(branch_id,cashier_id,opening,actual,difference,opened_at,closed_at)
      SELECT $1,$2,0,0,0,'2035-03-01T10:00:00.123456Z'::timestamptz,'2035-03-01T11:00:00Z'::timestamptz FROM generate_series(1,70)`,
      [b1, original.cashier_id],
    );
    const shiftBase = "/api/v1/owner/shifts?state=closed&branchId=" + b1;
    const shiftIds: string[] = [];
    cursor = null;
    do {
      const response: Response = await request(app)
        .get(
          shiftBase + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
        )
        .set(auth(owner));
      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeLessThanOrEqual(25);
      expect(response.body.items.every((s: any) => !s.open)).toBe(true);
      shiftIds.push(...response.body.items.map((s: any) => s.id));
      cursor = response.body.nextCursor;
    } while (cursor);
    expect(new Set(shiftIds).size).toBe(shiftIds.length);
    expect(shiftIds.length).toBeGreaterThanOrEqual(70);
    const state = await request(app)
      .get("/api/v1/owner/state")
      .set(auth(owner));
    expect(state.body.expenses).toEqual([]);
    expect(state.body.shifts.every((s: any) => s.open)).toBe(true);
    expect((await request(app).get(shiftBase).set(auth(cashier))).status).toBe(
      403,
    );
  });
});
