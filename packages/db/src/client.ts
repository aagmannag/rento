import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function buildAdapter(): PrismaPg {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Set it in .env.local (see .env.local.example).");
  }
  // Neon (and most managed Postgres providers) require SSL; local Docker/Postgres
  // doesn't speak it at all. Detect by host rather than NODE_ENV so this works
  // correctly regardless of how/where the app is actually running.
  const isLocalHost = /localhost|127\.0\.0\.1/.test(connectionString);

  return new PrismaPg(
    {
      connectionString,
      ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
    },
    {
      // A pooled connection that's just sitting idle can still emit an error if it
      // drops (e.g. the DB restarts or a network blip). Without this handler, Node
      // treats that as an uncaught exception and kills the whole process — for every
      // request in flight, not just whoever's query triggered it.
      onPoolError: (err) => console.error("Unexpected error on idle Postgres client:", err),
      onConnectionError: (err) => console.error("Unexpected error on a Postgres connection:", err),
    }
  );
}

// Next.js dev hot-reload re-evaluates this module on every edit; without caching the
// client on `globalThis`, each reload would open a fresh connection pool against Neon
// and never close the old ones, eventually exhausting the connection limit.
const globalForPrisma = globalThis as unknown as { __rentoPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__rentoPrisma ?? new PrismaClient({ adapter: buildAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__rentoPrisma = prisma;
}
