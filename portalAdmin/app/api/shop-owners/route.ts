import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { listShopOwners } from "@/lib/db";
import type { OwnerApprovalStatus } from "@/lib/types";

const VALID_STATUSES: OwnerApprovalStatus[] = ["Pending", "Approved", "Rejected", "Suspended"];

export async function GET(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as OwnerApprovalStatus)
    ? (statusParam as OwnerApprovalStatus)
    : undefined;

  const owners = await listShopOwners(status);
  return NextResponse.json({ owners });
}
