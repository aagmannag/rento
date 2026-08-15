import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingRowForUser, submitBookingPayment } from "@/lib/db";
import { getVehicleAvailability, syncPartnerBookingPayment } from "@/lib/partnerDb";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const timer = new RequestTimer("POST /api/bookings/[id]/payment");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const utrNumber = String(body?.utrNumber ?? "").trim();
  const screenshotUrl = body?.screenshotUrl ? String(body.screenshotUrl) : null;

  if (!utrNumber) {
    return NextResponse.json({ error: "Enter the UPI transaction reference (UTR) number." }, { status: 400 });
  }

  // Fetched once here, then reused by submitBookingPayment() below instead of it
  // re-querying the same row — this is also the raw row (with fields like
  // partnerBookingId that the public Booking shape omits) that submitBookingPayment
  // needs anyway.
  const existing = await getBookingRowForUser(params.id, session.userId);
  timer.mark("booking lookup");
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // getBookingRowForUser() above lazily flips a stale Pending booking to Expired the
  // moment its 5-minute hold window elapses — no separate cron job needed. Unlike
  // Rejected below, there's no resubmission path: the unit may already belong to
  // someone else, so the customer has to start a fresh booking instead.
  if (existing.paymentStatus === "Expired") {
    timer.total();
    return NextResponse.json(
      { error: "This booking's 5-minute payment window has expired. Please make a new booking." },
      { status: 409 }
    );
  }

  // A rejected booking's unit was released back to the pool the moment it was rejected —
  // resubmitting has to re-claim availability, since someone else may have booked it
  // in the meantime. Pending/Submitted bookings are already holding their unit, so no
  // re-check is needed there.
  if (existing.paymentStatus === "Rejected") {
    const availability = await getVehicleAvailability(existing.vehicleId);
    timer.mark("resubmission availability recheck");
    if (availability && availability.availableStock < existing.quantity) {
      return NextResponse.json(
        {
          error:
            availability.availableStock <= 0
              ? "Sorry, this vehicle has since been booked out by someone else. Please make a new booking for a different vehicle."
              : `Only ${availability.availableStock} unit${availability.availableStock > 1 ? "s" : ""} left now — that's fewer than your booking's quantity. Please make a new booking instead.`,
        },
        { status: 409 }
      );
    }
  }

  const result = await submitBookingPayment(existing, utrNumber, screenshotUrl);
  timer.mark("payment update (dedupe check + write)");
  if (!result.ok) {
    timer.total();
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.partnerBookingId) {
    await syncPartnerBookingPayment(result.partnerBookingId, "Submitted", utrNumber);
    timer.mark("partner portal sync");
  }
  timer.total();

  return NextResponse.json({ booking: result.booking });
}
