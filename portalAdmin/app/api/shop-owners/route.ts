import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { listShopOwners } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";
import type { OwnerApprovalStatus } from "@/lib/types";

const VALID_STATUSES: OwnerApprovalStatus[] = ["Pending", "Approved", "Rejected", "Suspended"];

// Polled by every admin dashboard on every DASHBOARD_POLL_INTERVAL_MS tick.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET(req: NextRequest) {
  const timer = new RequestTimer("GET /api/shop-owners");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as OwnerApprovalStatus)
    ? (statusParam as OwnerApprovalStatus)
    : undefined;

  const owners = await listShopOwners(status);
  timer.mark("db");
  const response = NextResponse.json({ owners });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}
