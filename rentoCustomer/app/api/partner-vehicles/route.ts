import { NextResponse } from "next/server";
import { getPartnerVehicles } from "@/lib/partnerDb";
import { RequestTimer } from "@/lib/perf";

// Must re-run on every request — partner vehicles change frequently and this route has
// no other dynamic API usage, so Next would otherwise cache it as a static response
// generated once at build time. The Cache-Control header below still lets the browser
// (and any CDN in front of it) skip the round trip entirely for a few seconds, on top
// of the server-side TTL cache in getPartnerVehicles().
export const dynamic = "force-dynamic";

// Well above the normal case so it doesn't fire on every request (this endpoint is hit
// on nearly every page load/tab focus — see providers.tsx), but low enough to actually
// catch the thing worth catching: this route regressing back into doing one network
// round trip to Neon per vehicle instead of one round trip total (see @rento/db's
// listActivePartnerVehiclesWithAvailability).
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/partner-vehicles");
  const vehicles = await getPartnerVehicles();
  timer.total(SLOW_REQUEST_THRESHOLD_MS);

  return NextResponse.json(
    { vehicles },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } }
  );
}
