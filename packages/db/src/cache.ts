import { Redis } from "@upstash/redis";

// Optional shared cache layer, sitting in front of the hottest read queries in this
// package (see vehicles.ts, rating.ts). Backed by Upstash's REST-based Redis — no
// persistent TCP connection to manage, so it's safe to call from any serverless/edge
// runtime, including a cold Vercel function invocation.
//
// Why this matters beyond the in-process TTL caches some callers already had
// (rentoCustomer's getPartnerVehicles, its platform-rating route): those live in one
// serverless instance's memory. Vercel runs many instances of the same function
// concurrently, each with its own empty cache — under real traffic, most requests still
// hit Neon directly no matter how good the in-process TTL is. A shared Redis cache is
// visible to every instance of every app that points at it, so the *first* request
// anywhere warms it for everyone.
//
// ALL THREE PORTALS (and this package) should point at the SAME Redis instance — that's
// what lets a write in one app (e.g. portalPartner adding a vehicle) invalidate a cache
// entry a different app (rentoCustomer) is serving from, instead of each app only ever
// clearing its own copy.
//
// Entirely optional and fails soft everywhere: if UPSTASH_REDIS_REST_URL/TOKEN (or
// Vercel KV's equivalent KV_REST_API_URL/TOKEN, provisioned the same way) aren't set,
// every function below just calls straight through to the source. Nothing here can ever
// make a request FAIL or behave differently — at worst it's exactly as slow as it was
// before this cache existed.
const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// The whole reason Redis exists here (see the comment above) is to share one cache
// across many concurrent *serverless* instances — `next dev` only ever runs a single
// long-lived process, so the in-process L1 tier below already gives every request the
// exact same benefit with zero network I/O. Worse, dev-mode's on-demand webpack
// compilation blocks the event loop for seconds at a time, which regularly delays even
// a healthy Redis response past CACHE_OP_TIMEOUT_MS — L1 has no such problem since a
// Map lookup needs no event-loop turnaround. Skipping Redis in dev removes an entire
// class of `[cache] ... timed out` noise and its 800ms tax for zero behavior change in
// production (this only affects local `next dev`/`next start`, never a real deploy).
// Set FORCE_REDIS_DEV=true to opt back in — e.g. to locally verify a cross-app cache
// invalidation (like a rating submitted in portalPartner clearing rentoCustomer's
// cached profile) actually reaches Redis, which the L1-only dev path can't exercise.
const skipRedisInDev = process.env.NODE_ENV !== "production" && process.env.FORCE_REDIS_DEV !== "true";

const redis: Redis | null =
  restUrl && restToken && !skipRedisInDev ? new Redis({ url: restUrl, token: restToken }) : null;

if (!redis && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn(
    skipRedisInDev
      ? "[cache] Skipping Redis in dev (see cache.ts) — using the in-process cache only. Set FORCE_REDIS_DEV=true to opt back in."
      : "[cache] UPSTASH_REDIS_REST_URL/TOKEN not set — running without a shared cache (every read hits Neon directly, same as before this layer existed)."
  );
}

/** True once at least one caller has actually configured Redis — exposed so app code
 *  can decide whether it's worth also keeping its own short in-process cache in front
 *  (still useful even with Redis configured: it saves the ~10-20ms REST round trip on
 *  requests that land on an already-warm instance). */
export const cacheEnabled = redis !== null;

// A Redis call that hangs (network partition, Upstash outage, cold TLS handshake) must
// never make a request slower than it would've been with no cache at all — race it
// against a timeout and treat "too slow to matter" the same as "unavailable". Well above
// Upstash's normal REST latency (usually single-digit-to-low-double-digit ms from a
// nearby region) but far below what would make caching a net loss.
const CACHE_OP_TIMEOUT_MS = 800;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// JSON can't natively represent `bigint` or `Date` — Prisma returns both throughout this
// package's raw/typed queries (see vehicles.ts's `booked: bigint`, every `createdAt`).
// The Upstash client JSON-encodes values for us, so a raw bigint would throw before it
// ever reached the network, and a raw Date would silently degrade into a plain string on
// the way back, breaking any caller that expects `.toISOString()` etc downstream. This
// pair of deep-walk transforms tags both on the way in and restores them on the way out,
// so a cache hit is indistinguishable from a fresh query result.
interface Tagged {
  __t: "bigint" | "date";
  v: string;
}

function isTagged(value: unknown): value is Tagged {
  return typeof value === "object" && value !== null && "__t" in value && "v" in value;
}

function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return { __t: "bigint", v: value.toString() } satisfies Tagged;
  if (value instanceof Date) return { __t: "date", v: value.toISOString() } satisfies Tagged;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}

function fromJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(fromJsonSafe);
  if (typeof value === "object") {
    if (isTagged(value)) return value.__t === "bigint" ? BigInt(value.v) : new Date(value.v);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = fromJsonSafe(v);
    return out;
  }
  return value;
}

// Collapses concurrent cache-miss calls for the same key within one process/instance
// into a single fetch. Without this, N requests landing at once on a cold cache (e.g.
// right after this instance spun up, or right after an invalidation) would each
// independently query Neon AND each independently race to write the same value back to
// Redis, instead of one query serving all N callers.
const inFlight = new Map<string, Promise<unknown>>();

// A same-process, in-memory tier in front of the Redis round trip itself. This exists
// for a very concrete, measured reason: Upstash's REST latency is only ~10-20ms when the
// database is in the same region as the app calling it, but a database in a *different*
// region can cost 300-500ms per call (TCP+TLS setup dominates at that distance) — at that
// point, unconditionally hitting Redis on every single call makes a cache-hit *slower*
// than the Neon query it's supposed to be replacing. This tier makes every getCached()
// caller immune to that regardless of which region Redis ends up in: only the first call
// for a given key within its TTL ever reaches Redis (or Neon) at all; every repeat call
// on this same process returns from memory in well under a millisecond.
//
// This does mean a different serverless instance can go on serving its own slightly
// stale L1 copy for up to `ttlSeconds` after a write elsewhere invalidates Redis — the
// same staleness budget every TTL-based cache in this app already accepts (see e.g.
// LISTING_CACHE_TTL_SECONDS in vehicles.ts), just now also covering the local process
// instead of only Redis. invalidateCache() below clears this instance's own copy
// immediately, so a write and the read that follows it *on the same instance* never see
// stale data even in the small window before Redis's DEL would otherwise take effect.
interface L1Entry {
  expiresAt: number;
  value: unknown;
}
const l1Cache = new Map<string, L1Entry>();

function l1Get<T>(key: string): T | undefined {
  const entry = l1Cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    l1Cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function l1Set(key: string, value: unknown, ttlSeconds: number): void {
  l1Cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Cache-aside read: serve `key` from this process's own memory if still fresh, else from
 * Redis if present and unexpired, else call `fetcher()` and cache its result at both
 * tiers for `ttlSeconds`. Falls straight through to `fetcher()` — no caching, no error,
 * no behavior change — whenever Redis isn't configured or a call to it fails/times out
 * (the in-memory tier still applies even then, so a slow/unconfigured Redis never
 * prevents at least same-process caching).
 */
export async function getCached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const l1 = l1Get<T>(key);
  if (l1 !== undefined) return l1;

  if (!redis) {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fetcher()
      .then((value) => {
        l1Set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  try {
    const cached = await withTimeout(redis.get<unknown>(key), CACHE_OP_TIMEOUT_MS, `GET ${key}`);
    if (cached !== null && cached !== undefined) {
      const value = fromJsonSafe(cached) as T;
      l1Set(key, value, ttlSeconds);
      return value;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[cache] GET ${key} failed, falling back to source:`, err);
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await fetcher();
      l1Set(key, value, ttlSeconds);
      // Fire-and-forget: the caller already has the value it needs — no reason to make
      // them wait on the cache write actually landing in Redis too.
      withTimeout(redis!.set(key, toJsonSafe(value), { ex: ttlSeconds }), CACHE_OP_TIMEOUT_MS, `SET ${key}`).catch(
        (err) => console.warn(`[cache] SET ${key} failed:`, err)
      );
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

/**
 * Best-effort delete of one or more keys — call this right after a write that makes a
 * cached read stale, so the very next read (from ANY of the three apps, since they share
 * this Redis instance) sees fresh data instead of waiting out the TTL. Clears this
 * process's own in-memory L1 entries synchronously (so a read on this same instance right
 * after the write is guaranteed fresh) and Redis best-effort — a failed Redis DEL just
 * means other instances fall back to their normal TTL, not a broken request, since the
 * write that triggered this has already succeeded by the time this runs.
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  for (const key of keys) l1Cache.delete(key);
  if (!redis || keys.length === 0) return;
  try {
    await withTimeout(redis.del(...keys), CACHE_OP_TIMEOUT_MS, `DEL ${keys.join(", ")}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[cache] DEL ${keys.join(", ")} failed:`, err);
  }
}
