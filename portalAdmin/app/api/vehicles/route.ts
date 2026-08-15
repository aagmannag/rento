import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { listAllVehicles } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Polled by every admin dashboard on every DASHBOARD_POLL_INTERVAL_MS tick.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/vehicles");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const vehicles = await listAllVehicles();
  timer.mark("db");
  const response = NextResponse.json({ vehicles });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
