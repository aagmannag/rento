import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { updateBookingStatus } from "@/lib/db";
import type { BookingStatus } from "@/lib/types";

const VALID_STATUSES: BookingStatus[] = ["Upcoming", "Completed", "Cancelled"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = body?.status as BookingStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ok = await updateBookingStatus(params.id, session.ownerId, status);
  if (!ok) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
