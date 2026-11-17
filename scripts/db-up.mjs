import { spawnSync } from "node:child_process";
const exists =
  spawnSync("docker", ["inspect", "dunia-corndog-db"], { stdio: "ignore" })
    .status === 0;
const args = exists
  ? ["start", "dunia-corndog-db"]
  : [
      "run",
      "--name",
      "dunia-corndog-db",
      "-e",
      "POSTGRES_USER=corndog",
      "-e",
      `POSTGRES_PASSWORD=${process.env.POSTGRES_PASSWORD || "corndog_local_only"}`,
      "-e",
      "POSTGRES_DB=dunia_corndog",
      "-p",
      "127.0.0.1:5432:5432",
      "-v",
      "corndog_pg:/var/lib/postgresql/data",
      "-d",
      "postgres:17-alpine",
    ];
const result = spawnSync("docker", args, { stdio: "inherit" });
process.exit(result.status || 0);
