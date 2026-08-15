import { NextRequest, NextResponse } from "next/server";
import { getPlatformRatingCached, listActivePartnerVehiclesWithAvailability } from "@rento/db";

export const dynamic = "force-dynamic";

// Proactively refreshes the caches every first-time visitor's homepage/vehicle-browsing
// depends on, so the query that repopulates them (and the Neon compute wake-up that can
// come with it, if the database has been idle) is paid by this scheduled job instead of
// by whichever real customer happens to land first after the cache/compute went cold.
// Triggered by an external scheduler (not Vercel Cron — that needs a Pro plan to run
// more often than once/day) hitting this URL every few minutes — comfortably under both
// LISTING_CACHE_TTL_SECONDS/PLATFORM_RATING_CACHE_TTL_SECONDS (see @rento/db) and Neon's
// typical auto-suspend window, so neither cache nor compute ever has the chance to go
// cold between calls.
//
// Only warms rentoCustomer's own public-facing reads — portalPartner/portalAdmin's
// dashboards are internal, low-traffic, and behind auth, so a cold first load there once
// in a while isn't worth a second cron job.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [vehicles, rating] = await Promise.all([
    listActivePartnerVehiclesWithAvailability(),
    getPlatformRatingCached(),
  ]);

  return NextResponse.json({ warmed: { vehicles: vehicles.length, rating: rating.value } });
}
