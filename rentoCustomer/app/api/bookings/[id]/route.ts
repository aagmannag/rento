import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingForUser } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Live, server-authoritative fetch for a single booking — used by the confirmation
// page to re-check status on load (deep links / stale client cache / a different
// device) and whenever its countdown timer runs out, since getBookingForUser() lazily
// flips a stale Pending booking to Expired the moment its payment hold window elapses.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const timer = new RequestTimer("GET /api/bookings/[id]");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const booking = await getBookingForUser(params.id, session.userId);
  timer.mark("booking lookup");
  timer.total();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ booking });
}
