import { pool, transaction } from "./index";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
await transaction(async (tx) => {
  await tx.query("SELECT pg_advisory_xact_lock(77340001)");
  await tx.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (await tx.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
        .rowCount
    )
      continue;
    await tx.query(await readFile(directory + name, "utf8"));
    await tx.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
    console.log("Applied", name);
  }
});
await pool.end();
