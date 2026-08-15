import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingRowForUser, submitPartnerRating, submitPlatformRating } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

const VALID_TARGETS = new Set(["partner", "platform"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const timer = new RequestTimer("POST /api/bookings/[id]/rating");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const target = body?.target;
  if (!VALID_TARGETS.has(target)) {
    return NextResponse.json({ error: "Invalid rating target" }, { status: 400 });
  }

  const existing = await getBookingRowForUser(params.id, session.userId);
  timer.mark("booking lookup");
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const result =
    target === "partner"
      ? await submitPartnerRating(existing, body?.stars, body?.comment)
      : await submitPlatformRating(existing, body?.stars, body?.comment);
  timer.mark("rating submission");
  timer.total();

  if (!result.ok) {
    // "Not eligible yet" / "already rated" are conflicts with current state, not
    // malformed input — 409 lets the client tell them apart from a plain 400.
    const status = result.error?.includes("already rated") || result.error?.includes("eligible") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ booking: result.booking });
}
