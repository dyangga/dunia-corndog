import { z } from "zod";
export * from "./types";
export const SIZES = ["Small", "Medium", "Jumbo"] as const;
export const CATEGORIES = ["Gurih pedas", "Manis"] as const;
export const MONEY = z.number().int().min(0).max(1_000_000_000_000);
export const id = z.uuid();
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(
    /^[a-z0-9._-]+$/,
    "Gunakan huruf, angka, titik, garis bawah atau tanda hubung.",
  );
export const password = z
  .string()
  .min(10, "Password minimal 10 karakter.")
  .max(128);
export const loginSchema = z.object({
  username,
  password: z.string().min(1).max(128),
  client: z.enum(["web", "native"]).default("web"),
});
export const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username,
  password: password.optional(),
  branches: z.array(id).min(1).max(20),
  active: z.boolean().default(true),
});
export const branchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().max(300).default(""),
  active: z.boolean().default(true),
});
export const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(CATEGORIES),
  prices: z
    .object({
      Small: MONEY.positive().optional(),
      Medium: MONEY.positive().optional(),
      Jumbo: MONEY.positive().optional(),
    })
    .refine(
      (p) => Object.values(p).some(Boolean),
      "Isi minimal satu harga ukuran.",
    ),
  potatoNoodleAllowed: z.boolean().default(false),
  active: z.boolean().default(true),
});
export const componentSchema = z.object({
  itemId: id,
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => Number(v) > 0 && Number(v) <= 1e9),
});
export const recipeSchema = z.object({
  skuId: id,
  branchId: id,
  mode: z.enum(["MADE_TO_ORDER", "READY_STOCK"]),
  finishedItemId: id.nullable().default(null),
  components: z.array(componentSchema).min(1).max(50),
});
export const checkoutSchema = z.object({
  shiftId: id,
  lines: z
    .array(
      z.object({
        skuId: id,
        quantity: z.number().int().min(1).max(999),
        modifierIds: z
          .array(id)
          .max(20)
          .refine((v) => new Set(v).size === v.length, "Topping duplikat."),
        note: z.string().max(200).default(""),
      }),
    )
    .min(1)
    .max(100),
  expectedTotal: MONEY.positive(),
  payment: z.object({
    method: z.enum(["Tunai", "QRIS", "Transfer"]),
    cashReceived: MONEY.optional(),
    confirmed: z.boolean().default(false),
    reference: z.string().max(150).default(""),
  }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "OWNER" | "CASHIER";
  businessId: string;
  branches: { id: string; name: string }[];
};
export type SessionResponse = {
  user: SessionUser;
  csrfToken?: string;
  token?: string;
};
export type PublicSku = {
  id: string;
  size: (typeof SIZES)[number];
  price: number;
  available: number;
};
export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  potatoNoodleAllowed: boolean;
  skus: PublicSku[];
};
export type CatalogModifier = {
  id: string;
  name: string;
  category: string;
  kind: "INCLUDED" | "EXTRA";
  price: number;
};
export type Catalog = {
  products: CatalogProduct[];
  modifiers: CatalogModifier[];
  version: string;
};
export type PublicShift = {
  id: string;
  branchId: string;
  opening: number;
  expected: number;
  openedAt: string;
};
export type PublicOrder = {
  id: string;
  number: string;
  branchId: string;
  cashier: string;
  shiftId: string;
  lines: {
    name: string;
    size: string;
    category: string;
    quantity: number;
    modifiers: string[];
    note: string;
    unitPrice: number;
  }[];
  total: number;
  received: number;
  method: string;
  status: string;
  refunded: boolean;
  createdAt: string;
};
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function createApiClient(
  baseUrl: string,
  credentials: () => { token?: string; csrfToken?: string } = () => ({}),
) {
  return async function request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      key?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const auth = credentials();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method || "GET",
        credentials: auth.token ? "omit" : "include",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          ...(auth.token
            ? { Authorization: `Bearer ${auth.token}` }
            : { "X-CSRF-Token": auth.csrfToken || "" }),
          ...(options.key ? { "Idempotency-Key": options.key } : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError(
        "NETWORK_ERROR",
        "Koneksi terputus. Periksa hasil transaksi sebelum mencoba kembali.",
        0,
      );
    }
    const data = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (!response.ok)
      throw new ApiError(
        data.error?.code || "API_ERROR",
        data.error?.message || "Permintaan gagal.",
        response.status,
        data.error?.details,
      );
    return data as T;
  };
}
