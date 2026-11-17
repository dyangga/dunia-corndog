import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
export const db = drizzle(pool);
export type Tx = pg.PoolClient;
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      const value = await work(tx);
      await tx.query("COMMIT");
      return value;
    } catch (error) {
      await tx.query("ROLLBACK");
      if (
        attempt === 2 ||
        !["40001", "40P01"].includes((error as { code?: string }).code || "")
      )
        throw error;
    } finally {
      tx.release();
    }
  }
  throw new Error("Transaction retry exhausted");
}

export * as schema from "./schema";
