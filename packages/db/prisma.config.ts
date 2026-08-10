import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // CLI-only (generate/migrate/studio/db pull) connection — the DIRECT (non-pooled)
  // URL, since `prisma migrate` needs a session-mode connection that Neon's pgbouncer
  // (transaction mode) can't provide. The running apps never read this file; they get
  // their own pooled connection via the PrismaPg adapter in src/client.ts.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
