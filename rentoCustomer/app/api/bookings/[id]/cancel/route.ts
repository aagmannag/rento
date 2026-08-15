import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingRowForUser, cancelBookingForUser } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Cancelling is idempotent-ish and cheap, but it writes to two tables and releases
// stock, so a stuck client retrying in a loop shouldn't be able to hammer it.
const CANCEL_LIMIT = 10;
const CANCEL_WINDOW_MS = 60_000;

/**
 * Self-service cancellation. The booking is looked up scoped to the session's user, so
 * one customer can never cancel another's booking by guessing an id — a booking that
 * isn't theirs is indistinguishable from one that doesn't exist (404 either way).
 *
 * The refund is computed server-side from the server's clock. The figure the customer
 * saw in the confirm dialog came from their own clock and is only ever an estimate;
 * whatever this route records is the authoritative one, and it's returned so the UI
 * can show what was actually applied rather than what it predicted.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const timer = new RequestTimer("POST /api/bookings/[id]/cancel");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const limit = rateLimit(`cancel:${session.userId}`, CANCEL_LIMIT, CANCEL_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many cancellation attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } }
    );
  }

  const existing = await getBookingRowForUser(params.id, session.userId);
  timer.mark("booking lookup");
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const result = await cancelBookingForUser(existing);
  timer.mark("cancellation");
  timer.total();

  if (!result.ok) {
    // Every failure here is a conflict with the booking's current state (already
    // cancelled, already completed, pickup passed, or changed underneath us) rather
    // than malformed input — 409 lets the client show the message and refresh, instead
    // of treating it as a bad request to retry verbatim.
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ booking: result.booking, refund: result.quote });
}
