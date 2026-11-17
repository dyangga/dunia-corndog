import { defineConfig } from "vitest/config";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://corndog:corndog_local_only@127.0.0.1:5432/dunia_corndog_test";
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw new Error("Integration tests require a separate *_test database.");
process.env.SEED_OWNER_PASSWORD = "OwnerTest123!";
process.env.SEED_CASHIER_PASSWORD = "KasirTest123!";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
