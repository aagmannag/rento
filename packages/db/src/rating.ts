import { prisma } from "./client";
import { getCached, invalidateCache } from "./cache";

// Shared rating display logic for the two-way ratings feature — used by rentoCustomer
// (shop rating shown on vehicle listings, platform rating shown on the homepage) and
// referenced by portalPartner's own rating-aggregate increments. See the doc comments
// on PartnerRating/PlatformRating/CustomerRating in schema.prisma for the full design.

/** Below this many real PartnerRating submissions, a shop's listings show the static
 *  seed instead of a computed average — avoids a brand-new shop looking unrated. */
export const SHOP_RATING_THRESHOLD = 5;
/** Seed value shown for a shop below SHOP_RATING_THRESHOLD — matches the value that
 *  was hardcoded on every vehicle before this feature existed, so nothing visually
 *  changes for an unrated shop. */
export const SHOP_RATING_STATIC_DEFAULT = 4.5;

/** Below this many real PlatformRating submissions, the homepage shows the static seed
 *  instead of the computed platform-wide average. */
export const PLATFORM_RATING_THRESHOLD = 20;
/** Seed value shown below PLATFORM_RATING_THRESHOLD — matches the value that was
 *  hardcoded on the homepage before this feature existed. */
export const PLATFORM_RATING_STATIC_DEFAULT = 4.7;

export interface DisplayRating {
  /** What to show — either the static seed or the real rounded-to-1-decimal average. */
  value: number;
  /** The real number of ratings received so far (even while showing the static seed —
   *  callers that want to show "12 ratings" alongside a still-static value can). */
  count: number;
  /** True once `value` is the real computed average rather than the static seed. */
  isDynamic: boolean;
}

/**
 * Turns a cached (sum, count) aggregate into what should actually be displayed,
 * applying the static→dynamic threshold switch. `sum / count` rather than a running
 * float average is what's cached upstream specifically so this can always recompute
 * the exact average without accumulating float drift across many increments.
 *
 * This switch is one-way in normal operation (count only grows via new ratings) but
 * is NOT re-derived from any separate "isDynamic" flag — it's computed fresh from the
 * same count every time, so it can never desync from the real data even if a rating is
 * later removed by moderation (see the model doc comments for that edge case).
 */
export function computeDisplayRating(
  sum: number,
  count: number,
  threshold: number,
  staticDefault: number
): DisplayRating {
  if (count < threshold) {
    return { value: staticDefault, count, isDynamic: false };
  }
  return { value: Math.round((sum / count) * 10) / 10, count, isDynamic: true };
}

const PLATFORM_RATING_CACHE_KEY = "cache:v1:rating:platform";
// This only ever changes when a customer submits a PlatformRating — rare compared to how
// often it's read (every homepage load, every ~20s poll per logged-in session, see
// rentoCustomer's providers.tsx) — so it can afford a much longer TTL than the vehicle
// listing cache. invalidatePlatformRatingCache() below also clears it immediately on
// write, so this TTL only matters as a fallback if that invalidation call is ever missed.
const PLATFORM_RATING_CACHE_TTL_SECONDS = 30;

/** The platform-wide DisplayRating, shared across every app/instance via Redis (falls
 *  back to querying Neon directly when Redis isn't configured — see ./cache). */
export async function getPlatformRatingCached(): Promise<DisplayRating> {
  return getCached(PLATFORM_RATING_CACHE_KEY, PLATFORM_RATING_CACHE_TTL_SECONDS, async () => {
    const agg = await prisma.platformRating.aggregate({ _sum: { stars: true }, _count: true });
    return computeDisplayRating(agg._sum.stars ?? 0, agg._count, PLATFORM_RATING_THRESHOLD, PLATFORM_RATING_STATIC_DEFAULT);
  });
}

/** Call right after a new PlatformRating is inserted, so the homepage stat updates
 *  immediately instead of waiting out PLATFORM_RATING_CACHE_TTL_SECONDS. */
export function invalidatePlatformRatingCache(): void {
  void invalidateCache([PLATFORM_RATING_CACHE_KEY]);
}

// rentoCustomer's own /api/me (getUserById) — the key builder lives here, not there,
// because portalPartner's submitCustomerRating is a second, cross-app writer to this
// same row (it increments User.ratingSum/ratingCount when a shop owner rates a
// customer) and needs to invalidate the exact same cache entry rentoCustomer reads.
// Measured via RequestTimer: /api/me is polled every 20s per logged-in tab (see
// rentoCustomer's providers.tsx) and was paying a full ~200-300ms warm / 1-3s cold Neon
// round trip on every single call — unlike the list endpoints (bookings, vehicles),
// nothing here was ever cached. TTL must comfortably exceed that 20s poll interval —
// this was originally set to 10s, which meant every scheduled poll landed after the
// entry had already expired and missed the cache on every single tick. 25s keeps a
// safety margin above the poll while still bounding staleness to well under a minute.
export const customerUserCacheKey = (userId: string) => `cache:v1:customer:user:${userId}`;
export const CUSTOMER_USER_CACHE_TTL_SECONDS = 25;
export function invalidateCustomerUserCache(userId: string): void {
  void invalidateCache([customerUserCacheKey(userId)]);
}
