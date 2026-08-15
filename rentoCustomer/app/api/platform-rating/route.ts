import { NextResponse } from "next/server";
import { getPlatformRatingCached } from "@rento/db";

export const dynamic = "force-dynamic";

// getPlatformRatingCached() already caches this (both an in-process tier and a shared
// Redis tier — see @rento/db's cache.ts), invalidated immediately on write rather than
// relying purely on TTL (see invalidatePlatformRatingCache, called from
// submitPlatformRating) — nothing left for this route to do beyond calling it.
export async function GET() {
  const rating = await getPlatformRatingCached();
  return NextResponse.json({ rating });
}
