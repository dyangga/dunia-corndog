import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core";
export const businesses = pgTable("businesses", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  timezone: text().notNull(),
});
export const branches = pgTable("branches", {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  name: text().notNull(),
  address: text().notNull(),
  active: boolean().notNull(),
});
export const users = pgTable("app_users", {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  name: text().notNull(),
  username: text().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text().notNull(),
  active: boolean().notNull(),
});
export const sessions = pgTable("auth_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
export const products = pgTable("products", {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  name: text().notNull(),
  category: text().notNull(),
  active: boolean().notNull(),
  potatoNoodleAllowed: boolean("potato_noodle_allowed").notNull(),
  version: integer().notNull(),
});
export const skus = pgTable("skus", {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(),
  size: text().notNull(),
  price: bigint({ mode: "number" }).notNull(),
  active: boolean().notNull(),
});
