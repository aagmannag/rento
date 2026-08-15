import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingsForOwner } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

// Hit on every owner dashboard load/poll (see lib/hooks.ts) — only log when it's
// actually slow rather than on every call, same threshold reasoning as
// rentoCustomer's vehicle-availability/partner-vehicles routes.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/bookings");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const bookings = await getBookingsForOwner(session.ownerId);
  timer.mark("db");
  const response = NextResponse.json({ bookings });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
