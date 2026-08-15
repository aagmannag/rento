import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getPlatformStats } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Polled by every admin dashboard on every DASHBOARD_POLL_INTERVAL_MS tick.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/stats");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const stats = await getPlatformStats();
  timer.mark("db");
  const response = NextResponse.json({ stats });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
