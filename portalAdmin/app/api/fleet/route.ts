import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getFleetAvailability } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Polled by the fleet page every 8s — threshold is higher than normal because this
// query does two DB round trips (vehicles + booking counts) even though both are
// parallelised with Promise.all; any regression back to N+1 would be caught at ~300ms.
const SLOW_REQUEST_THRESHOLD_MS = 500;

export async function GET() {
  const timer = new RequestTimer("GET /api/fleet");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const fleet = await getFleetAvailability();
  timer.mark("db");
  const response = NextResponse.json({ fleet });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
