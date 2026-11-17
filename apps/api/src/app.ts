import { ownerExpenses, ownerShifts } from "./owner-records";
import { ownerOrders, ownerOrderDetail, reportOverview } from "./owner-reports";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "@dc/db";
import { loginSchema, checkoutSchema, id, MONEY } from "@dc/contracts";
import {
  login,
  authenticate,
  owner,
  branchScope,
  audit,
  idempotent,
  type Actor,
} from "./auth";
import { HttpError, fail } from "./errors";
import { catalog, checkout, publicOrder } from "./catalog";
import * as operations from "./operations";
import * as queries from "./queries";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  const allowed = [
    ...(process.env.WEB_ORIGIN || "http://localhost:3000").split(","),
    ...(process.env.MOBILE_WEB_ORIGIN || "http://localhost:8081").split(","),
    ...(process.env.NODE_ENV !== "production"
      ? ["http://127.0.0.1:3000", "http://127.0.0.1:8081"]
      : []),
  ];
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "Idempotency-Key",
      ],
    }),
  );
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set("X-Request-Id", res.locals.requestId);
    res.set("Cache-Control", "no-store");
    const origin = req.get("Origin");
    if (
      origin &&
      !allowed.includes(origin) &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    )
      return next(
        new HttpError(
          403,
          "ORIGIN_REJECTED",
          "Asal permintaan tidak diizinkan.",
        ),
      );
    next();
  });
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });
  const api = express.Router();
  app.use("/api/v1", api);
  api.post(
    "/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Terlalu banyak percobaan login. Coba lagi nanti.",
        },
      },
    }),
    async (req, res) => {
      const input = loginSchema.parse(req.body);
      const session = await login(input.username, input.password);
      if (input.client === "web")
        res.cookie("dc_session", session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 12 * 60 * 60 * 1000,
        });
      res.json({
        user: session.user,
        ...(input.client === "native"
          ? { token: session.token }
          : { csrfToken: session.csrfToken }),
      });
    },
  );
  api.use(authenticate);
  const actor = (res: express.Response) => res.locals.actor as Actor;
  api.get("/auth/me", (req, res) => {
    const a = actor(res);
    res.json({
      user: {
        id: a.id,
        name: a.name,
        username: a.username,
        role: a.role,
        businessId: a.businessId,
        branches: a.branches,
      },
      ...(!a.bearer ? { csrfToken: a.csrfToken } : {}),
    });
  });
  api.post("/auth/logout", async (req, res) => {
    await pool.query("UPDATE auth_sessions SET revoked_at=now() WHERE id=$1", [
      actor(res).sessionId,
    ]);
    res.clearCookie("dc_session", { path: "/" });
    res.json({ ok: true });
  });
  api.get("/branches", async (req, res) => {
    const a = actor(res);
    if (a.role === "OWNER")
      res.json(
        (
          await pool.query(
            "SELECT id,name,address,active FROM branches WHERE business_id=$1 ORDER BY name",
            [a.businessId],
          )
        ).rows,
      );
    else res.json(a.branches);
  });
  api.post("/branches", async (req, res) =>
    res.status(201).json(await operations.saveBranch(actor(res), req.body)),
  );
  api.patch("/branches/:id", async (req, res) =>
    res.json(
      await operations.saveBranch(
        actor(res),
        req.body,
        id.parse(req.params.id),
      ),
    ),
  );
  api.get("/staff", async (req, res) => {
    owner(actor(res));
    res.json((await queries.ownerState(actor(res))).users);
  });
  api.post("/staff", async (req, res) =>
    res.status(201).json(await operations.saveStaff(actor(res), req.body)),
  );
  api.patch("/staff/:id", async (req, res) =>
    res.json(
      await operations.saveStaff(actor(res), req.body, id.parse(req.params.id)),
    ),
  );
  api.get("/owner/state", async (req, res) =>
    res.json(await queries.ownerState(actor(res))),
  );
  api.get("/owner/expenses", async (req, res) => {
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    res.json(
      await ownerExpenses(
        actor(res),
        from,
        to,
        id.optional().parse(req.query.branchId),
        z.string().max(500).optional().parse(req.query.cursor),
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .parse(req.query.limit),
      ),
    );
  });
  api.get("/owner/shifts", async (req, res) => {
    res.json(
      await ownerShifts(
        actor(res),
        id.optional().parse(req.query.branchId),
        z
          .enum(["all", "active", "closed"])
          .default("all")
          .parse(req.query.state),
        z.string().max(500).optional().parse(req.query.cursor),
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .parse(req.query.limit),
      ),
    );
  });
  api.get("/owner/orders", async (req, res) => {
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    res.json(
      await ownerOrders(
        actor(res),
        from,
        to,
        id.optional().parse(req.query.branchId),
        z
          .enum(["Semua", "Tunai", "QRIS", "Transfer", "Refund"])
          .default("Semua")
          .parse(req.query.method),
        z.string().max(100).default("").parse(req.query.search),
        z.string().regex(/^\d+$/).optional().parse(req.query.cursor),
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .parse(req.query.limit),
      ),
    );
  });
  api.get("/owner/orders/:id", async (req, res) => {
    const row = await ownerOrderDetail(actor(res), id.parse(req.params.id));
    if (!row) fail(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    res.json(row);
  });
  api.get("/reports/overview", async (req, res) => {
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    res.json(
      await reportOverview(
        actor(res),
        from,
        to,
        id.optional().parse(req.query.branchId),
      ),
    );
  });
  api.get("/catalog", async (req, res) =>
    res.json(await catalog(actor(res), id.parse(req.query.branchId))),
  );
  api.post("/products", async (req, res) =>
    res.status(201).json(await operations.saveProduct(actor(res), req.body)),
  );
  api.patch("/products/:id", async (req, res) =>
    res.json(
      await operations.saveProduct(
        actor(res),
        req.body,
        id.parse(req.params.id),
      ),
    ),
  );
  api.get("/inventory", async (req, res) =>
    res.json(await queries.inventory(actor(res), id.parse(req.query.branchId))),
  );
  api.post("/inventory/items", async (req, res) =>
    res.status(201).json(await operations.createItem(actor(res), req.body)),
  );
  api.patch("/inventory/:id/minimum", async (req, res) => {
    const a = actor(res);
    owner(a);
    const itemId = id.parse(req.params.id),
      data = z
        .object({
          branchId: id,
          minimum: z.string().regex(/^\d+(\.\d{1,3})?$/),
        })
        .parse(req.body);
    await transaction(async (tx) => {
      await branchScope(a, data.branchId, tx);
      const row = await tx.query(
        "UPDATE stock_balances s SET minimum=$3 FROM stock_items i WHERE s.item_id=i.id AND i.business_id=$4 AND s.branch_id=$1 AND s.item_id=$2 RETURNING s.item_id",
        [data.branchId, itemId, data.minimum, a.businessId],
      );
      if (!row.rowCount) fail(404, "NOT_FOUND", "Item stok tidak ditemukan.");
      await audit(tx, a, "MINIMUM_UPDATED", itemId, data);
    });
    res.json({ ok: true });
  });
  api.get("/recipes", async (req, res) => {
    const a = actor(res);
    owner(a);
    res.json(
      (
        await pool.query(
          "SELECT r.*,s.size,s.product_id,p.name product_name FROM recipes r JOIN skus s ON s.id=r.sku_id JOIN products p ON p.id=s.product_id WHERE p.business_id=$1",
          [a.businessId],
        )
      ).rows,
    );
  });
  api.get("/skus", async (req, res) => {
    owner(actor(res));
    res.json(
      (
        await pool.query(
          "SELECT s.*,p.name,p.category FROM skus s JOIN products p ON p.id=s.product_id WHERE p.business_id=$1 AND s.active",
          [actor(res).businessId],
        )
      ).rows.map((s) => ({ ...s, price: Number(s.price) })),
    );
  });
  api.put("/recipes", async (req, res) =>
    res.json(await operations.saveRecipe(actor(res), req.body)),
  );
  api.get("/modifier-recipes", async (req, res) => {
    const a = actor(res);
    owner(a);
    const branch = id.parse(req.query.branchId);
    await branchScope(a, branch);
    res.json(
      (
        await pool.query("SELECT * FROM modifier_recipes WHERE branch_id=$1", [
          branch,
        ])
      ).rows,
    );
  });
  api.put("/modifier-recipes", async (req, res) =>
    res.json(await operations.saveModifierRecipe(actor(res), req.body)),
  );
  for (const type of ["receive", "transfer", "waste", "count"])
    api.post(`/inventory/${type}`, async (req, res) =>
      res.json(
        await idempotent(
          actor(res),
          `stock-${type}`,
          req.get("Idempotency-Key"),
          req.body,
          (tx) => operations.stockMovement(tx, actor(res), type, req.body),
        ),
      ),
    );
  api.post("/production", async (req, res) =>
    res.json(
      await idempotent(
        actor(res),
        "production",
        req.get("Idempotency-Key"),
        req.body,
        (tx) => operations.production(tx, actor(res), req.body),
      ),
    ),
  );
  api.post("/expenses", async (req, res) =>
    res
      .status(201)
      .json(
        await idempotent(
          actor(res),
          "expense",
          req.get("Idempotency-Key"),
          req.body,
          (tx) => operations.expense(tx, actor(res), req.body),
        ),
      ),
  );
  api.post("/expenses/:id/reverse", async (req, res) => {
    const expenseId = id.parse(req.params.id);
    res.json(
      await idempotent(
        actor(res),
        "expense-reverse",
        req.get("Idempotency-Key"),
        { expenseId, ...req.body },
        (tx) => operations.reverseExpense(tx, actor(res), expenseId, req.body),
      ),
    );
  });
  api.get("/orders/:id/consumption", async (req, res) => {
    const a = actor(res);
    owner(a);
    const orderId = id.parse(req.params.id);
    const order = await queries.getOrder(a, orderId);
    if (!order) fail(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    res.json(
      (
        await pool.query(
          "SELECT l.item_id,i.name,i.unit,sum(-l.quantity_delta) quantity FROM stock_ledger l JOIN stock_items i ON i.id=l.item_id WHERE source_type='SALE' AND source_id=$1 GROUP BY l.item_id,i.name,i.unit",
          [orderId],
        )
      ).rows,
    );
  });
  api.patch("/requests/:id", async (req, res) => {
    const a = actor(res);
    owner(a);
    const requestId = id.parse(req.params.id);
    await transaction(async (tx) => {
      const changed = await tx.query(
        "UPDATE requests SET resolved=true WHERE id=$1 AND business_id=$2 RETURNING id",
        [requestId, a.businessId],
      );
      if (!changed.rowCount) fail(404, "NOT_FOUND", "Laporan tidak ditemukan.");
      await audit(tx, a, "REQUEST_RESOLVED", requestId);
    });
    res.json({ ok: true });
  });
  api.get("/shifts/current", async (req, res) =>
    res.json(await queries.activeShift(actor(res))),
  );
  api.post("/shifts/open", async (req, res) =>
    res
      .status(201)
      .json(
        await idempotent(
          actor(res),
          "shift-open",
          req.get("Idempotency-Key"),
          req.body,
          (tx) => operations.openShift(tx, actor(res), req.body),
        ),
      ),
  );
  api.post("/shifts/:id/close", async (req, res) => {
    const shift = id.parse(req.params.id);
    res.json(
      await idempotent(
        actor(res),
        "shift-close",
        req.get("Idempotency-Key"),
        { shift, ...req.body },
        (tx) => operations.closeShift(tx, actor(res), shift, req.body),
      ),
    );
  });
  api.post("/checkout", async (req, res) => {
    const data = checkoutSchema.parse(req.body);
    res
      .status(201)
      .json(
        await idempotent(
          actor(res),
          "checkout",
          req.get("Idempotency-Key"),
          data,
          (tx) => checkout(tx, actor(res), data),
        ),
      );
  });
  api.get("/operations/:operation/:key", async (req, res) => {
    const row = (
      await pool.query(
        "SELECT response FROM idempotency_keys WHERE actor_id=$1 AND operation=$2 AND key=$3",
        [actor(res).id, req.params.operation, req.params.key],
      )
    ).rows[0];
    res.json({ found: !!row, result: row?.response || null });
  });
  api.get("/orders", async (req, res) =>
    res.json(
      await queries.listOrders(
        actor(res),
        id.parse(req.query.branchId),
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .parse(req.query.limit),
        z.string().regex(/^\d+$/).optional().parse(req.query.cursor),
        req.query.active === "true",
      ),
    ),
  );
  api.get("/orders/export", async (req, res) => {
    const a = actor(res);
    owner(a);
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    const branch = id.optional().parse(req.query.branchId),
      method = z
        .enum(["Semua", "Tunai", "QRIS", "Transfer", "Refund"])
        .default("Semua")
        .parse(req.query.method),
      search = z.string().max(100).default("").parse(req.query.search);
    if (branch) await branchScope(a, branch);
    const rows = (
      await pool.query(
        `SELECT o.*,u.name cashier_name,b.name branch_name,r.id refund_id,r.created_at refund_at FROM orders o JOIN app_users u ON u.id=o.cashier_id JOIN branches b ON b.id=o.branch_id LEFT JOIN refunds r ON r.order_id=o.id WHERE o.business_id=$1 AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR o.branch_id=$4) AND ($5='Semua' OR ($5='Refund' AND r.id IS NOT NULL) OR o.method=$5) AND position(lower($6) in lower(concat('DC-',lpad(o.number::text,6,'0'),' ',o.id::text,' ',u.name,' ',b.name)))>0 ORDER BY o.created_at DESC`,
        [a.businessId, from, to, branch || null, method, search],
      )
    ).rows;
    const safe = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const lines = [
      [
        "Nomor",
        "Tanggal bayar",
        "Cabang",
        "Kasir",
        "Metode",
        "Nilai (IDR)",
        "Status",
        "Tanggal refund",
      ],
      ...rows.map((o) => [
        `DC-${String(o.number).padStart(6, "0")}`,
        queries.businessDate(o.created_at),
        o.branch_name,
        o.cashier_name,
        o.method,
        o.total,
        o.refund_id ? "Refund" : o.status,
        o.refund_at ? queries.businessDate(o.refund_at) : "",
      ]),
    ];
    res
      .type("text/csv")
      .attachment("transaksi.csv")
      .send(
        "\uFEFF" + lines.map((line) => line.map(safe).join(",")).join("\r\n"),
      );
  });
  api.get("/orders/:id", async (req, res) => {
    const row = await queries.getOrder(actor(res), id.parse(req.params.id));
    if (!row) fail(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    res.json(row);
  });
  api.patch("/orders/:id/status", async (req, res) => {
    const orderId = id.parse(req.params.id),
      data = z
        .object({ status: z.enum(["Diproses", "Siap", "Selesai"]) })
        .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const a = actor(res);
        const row = (
          await tx.query(
            "SELECT * FROM orders WHERE id=$1 AND business_id=$2 FOR UPDATE",
            [orderId, a.businessId],
          )
        ).rows[0];
        if (!row) fail(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
        await branchScope(a, row.branch_id, tx);
        const next: Record<string, string> = {
          Antrean: "Diproses",
          Diproses: "Siap",
          Siap: "Selesai",
        };
        if (next[row.status] !== data.status)
          fail(409, "INVALID_STATUS", "Status harus maju satu tahap.");
        if (
          (await tx.query("SELECT 1 FROM refunds WHERE order_id=$1", [orderId]))
            .rowCount
        )
          fail(409, "REFUNDED", "Transaksi sudah direfund.");
        await tx.query("UPDATE orders SET status=$2 WHERE id=$1", [
          orderId,
          data.status,
        ]);
        await audit(tx, a, "ORDER_STATUS", orderId, data);
        return { id: orderId, status: data.status };
      }),
    );
  });
  api.post("/orders/:id/refund", async (req, res) => {
    const orderId = id.parse(req.params.id);
    res.json(
      await idempotent(
        actor(res),
        "refund",
        req.get("Idempotency-Key"),
        { orderId, ...req.body },
        (tx) => operations.refund(tx, actor(res), orderId, req.body),
      ),
    );
  });
  api.post("/requests", async (req, res) => {
    const a = actor(res),
      data = z
        .object({
          branchId: id,
          kind: z.enum(["REFUND", "STOCK"]),
          orderId: id.optional(),
          message: z.string().trim().min(5).max(500),
        })
        .parse(req.body);
    await branchScope(a, data.branchId);
    if (data.orderId) {
      const order = await queries.getOrder(a, data.orderId);
      if (!order || order.branchId !== data.branchId)
        fail(404, "NOT_FOUND", "Transaksi tidak ditemukan pada cabang ini.");
    }
    const row = (
      await pool.query(
        "INSERT INTO requests(business_id,branch_id,actor_id,kind,order_id,message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          a.businessId,
          data.branchId,
          a.id,
          data.kind,
          data.orderId || null,
          data.message,
        ],
      )
    ).rows[0];
    res.status(201).json(row);
  });
  api.get("/notifications", async (req, res) => {
    const a = actor(res);
    owner(a);
    const requests = (
      await pool.query(
        "SELECT id,kind,message,branch_id,order_id,created_at FROM requests WHERE business_id=$1 AND NOT resolved ORDER BY created_at DESC LIMIT 100",
        [a.businessId],
      )
    ).rows;
    const low = (
      await pool.query(
        "SELECT s.item_id id,s.branch_id,i.name,s.quantity,s.minimum FROM stock_balances s JOIN stock_items i ON i.id=s.item_id WHERE i.business_id=$1 AND s.quantity<s.minimum",
        [a.businessId],
      )
    ).rows;
    res.json({ requests, lowStock: low });
  });
  api.get("/reports", async (req, res) => {
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    res.json(
      await queries.reports(
        actor(res),
        from,
        to,
        id.optional().parse(req.query.branchId),
      ),
    );
  });
  api.get("/reports/export", async (req, res) => {
    const from = z.iso.date().parse(req.query.from),
      to = z.iso.date().parse(req.query.to);
    if (from > to) fail(400, "INVALID_PERIOD", "Rentang tanggal tidak valid.");
    const totals = await queries.reports(
      actor(res),
      from,
      to,
      id.optional().parse(req.query.branchId),
    );
    res
      .type("text/csv")
      .attachment("laporan.csv")
      .send(
        "Metrik,Nilai\n" +
          Object.entries(totals)
            .map(
              ([key, value]) =>
                `"${key}","${String(value ?? "").replaceAll('"', '""')}"`,
            )
            .join("\n"),
      );
  });
  api.patch("/business", async (req, res) => {
    const a = actor(res);
    owner(a);
    const data = z
      .object({ name: z.string().trim().min(2).max(100) })
      .parse(req.body);
    await transaction(async (tx) => {
      await tx.query("UPDATE businesses SET name=$2 WHERE id=$1", [
        a.businessId,
        data.name,
      ]);
      await audit(tx, a, "BUSINESS_UPDATED", a.businessId, data);
    });
    res.json({ ok: true });
  });
  api.use((_req, _res) => fail(404, "NOT_FOUND", "Endpoint tidak ditemukan."));
  app.use(
    (
      error: any,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof z.ZodError)
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues[0]?.message || "Data tidak valid.",
            fieldErrors: z.flattenError(error).fieldErrors,
            requestId: res.locals.requestId,
          },
        });
      if (error.code === "23505")
        return res.status(409).json({
          error: {
            code: "DUPLICATE",
            message: "Username, nama, atau shift aktif sudah digunakan.",
            requestId: res.locals.requestId,
          },
        });
      if (error instanceof HttpError)
        return res.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            requestId: res.locals.requestId,
          },
        });
      console.error("API_ERROR", res.locals.requestId, error.message);
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan server.",
          requestId: res.locals.requestId,
        },
      });
    },
  );
  return app;
}
