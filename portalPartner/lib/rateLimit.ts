import { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory, per-process — fine for a single Node instance per app (our deployment
// target). If this app is ever run as multiple instances behind a load balancer, this
// would need to move to a shared store (e.g. Redis) to stay effective across instances.
const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map doesn't grow unbounded from one-off keys (e.g. distinct
// IPs/emails that never come back). unref() so this timer never keeps the process alive.
const cleanup = setInterval(() => {
  const now = Date.now();
  buckets.forEach((bucket, key) => {
    if (now >= bucket.resetAt) buckets.delete(key);
  });
}, 5 * 60 * 1000);
cleanup.unref?.();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Fixed-window counter: `limit` attempts per `windowMs` per key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true };
}

/** Best-effort client IP: trusts the first hop's X-Forwarded-For (set by our own
 *  reverse proxy in production); falls back to a constant in local dev where there's
 *  no proxy in front of Next.js. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
