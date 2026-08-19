import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` never connects to the database — it only reads schema.prisma
// and emits the TypeScript client. The URL here is only consumed by the CLI commands
// that DO need a live connection: `prisma migrate dev/deploy`, `prisma db pull`,
// and `prisma studio`. Those are always run locally where packages/db/.env is
// present with a real DIRECT_URL.
//
// Using process.env directly (instead of the throwing `env()` helper) allows
// `postinstall` → `prisma generate` to succeed on Vercel, in CI, and on any fresh
// clone where DIRECT_URL is not set — without breaking migrations locally.
const datasourceUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  // Placeholder — syntactically valid but never used for `generate`.
  // Migrations will fail with a clear connection error if you accidentally run
  // `prisma migrate` without a real .env, which is the correct failure mode.
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

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
    url: datasourceUrl,
  },
});
