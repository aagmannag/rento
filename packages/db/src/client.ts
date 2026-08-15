import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Flags queries slow enough to be worth investigating without logging every query (that
// would drown genuine problems in noise). 200ms is well above this app's normal ~1
// round-trip cost to Neon (~150-190ms measured) but well below what a user would
// perceive as broken — a query that regularly exceeds it is worth a look.
const SLOW_QUERY_THRESHOLD_MS = 200;

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
      // node-postgres defaults this to 0 (no timeout) — if Neon is ever unreachable or
      // very slow, requests would otherwise hang indefinitely instead of failing fast
      // with a clear error.
      connectionTimeoutMillis: 10_000,
      // node-postgres defaults this to 10s — far shorter than typical gaps between a
      // user's page navigations, so the pool was constantly tearing down and
      // reopening connections (each reopen re-pays the TCP+TLS handshake to Neon, and
      // can also hit Neon's own compute auto-suspend/wake latency on top — measured
      // ~2s for a "cold" request vs ~180ms warm). A long-lived server process can
      // afford to hold idle connections open much longer.
      idleTimeoutMillis: 60_000,
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

function buildClient(): PrismaClient {
  const client = new PrismaClient({
    adapter: buildAdapter(),
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });

  // Every query round-trips to Neon over a real network connection — there's no way to
  // tell "slow because of a missing index" from "slow because of network/cold-start
  // latency" without seeing individual query timings. Only the slow ones are logged
  // (see SLOW_QUERY_THRESHOLD_MS) so this stays useful signal, not noise.
  client.$on("query", (event) => {
    if (event.duration >= SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[slow query] ${event.duration}ms: ${event.query}`);
    }
  });

  return client;
}

// Next.js dev hot-reload re-evaluates this module on every edit; without caching the
// client on `globalThis`, each reload would open a fresh connection pool against Neon
// and never close the old ones, eventually exhausting the connection limit.
const globalForPrisma = globalThis as unknown as { __rentoPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__rentoPrisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__rentoPrisma = prisma;
}
