import { createApp } from "./app";
import { pool } from "@dc/db";
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL wajib diisi. Salin .env.example ke .env.");
const port = Number(process.env.API_PORT || 4000);
const server = createApp().listen(port, "0.0.0.0", () =>
  console.log(`Dunia Corndog API: http://localhost:${port}/api/v1`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    }),
  );
