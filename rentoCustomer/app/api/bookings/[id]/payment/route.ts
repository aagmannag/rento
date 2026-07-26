import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingForUser, submitBookingPayment } from "@/lib/db";
import { getVehicleAvailability, syncPartnerBookingPayment } from "@/lib/partnerDb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const utrNumber = String(body?.utrNumber ?? "").trim();
  const screenshotUrl = body?.screenshotUrl ? String(body.screenshotUrl) : null;

  if (!utrNumber) {
    return NextResponse.json({ error: "Enter the UPI transaction reference (UTR) number." }, { status: 400 });
  }

  const existing = await getBookingForUser(params.id, session.userId);
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // A rejected booking's unit was released back to the pool the moment it was rejected —
  // resubmitting has to re-claim availability, since someone else may have booked it
  // in the meantime. Pending/Submitted bookings are already holding their unit, so no
  // re-check is needed there.
  if (existing.paymentStatus === "Rejected") {
    const availability = await getVehicleAvailability(existing.vehicleId);
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

  const result = await submitBookingPayment(params.id, session.userId, utrNumber, screenshotUrl);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.partnerBookingId) {
    await syncPartnerBookingPayment(result.partnerBookingId, "Submitted", utrNumber);
  }

  return NextResponse.json({ booking: result.booking });
}
