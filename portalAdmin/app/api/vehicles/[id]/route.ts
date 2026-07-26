import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { setVehicleStatus } from "@/lib/db";
import type { VehicleStatus } from "@/lib/types";

const VALID_STATUSES: VehicleStatus[] = ["Active", "Inactive"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = body?.status as VehicleStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ok = await setVehicleStatus(params.id, status);
  if (!ok) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
