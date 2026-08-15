import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { listPendingPayments } from "@/lib/paymentsDb";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Polled by every admin dashboard on every DASHBOARD_POLL_INTERVAL_MS tick (see
// lib/hooks.ts) — only log when it's actually slow, same threshold reasoning as the
// other portals' hot GET routes.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/payments");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const payments = await listPendingPayments();
  timer.mark("db");
  const response = NextResponse.json({ payments });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
