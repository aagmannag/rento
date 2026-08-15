import { NextRequest, NextResponse } from "next/server";
import { MIN_ONLINE_PAYMENT_RUPEES } from "@rento/db";
import { readSessionFromCookies } from "@/lib/session";
import { createCustomerBooking, getBookingsForUser, getUserById } from "@/lib/db";
import { createPartnerBooking, getVehicleAvailability, getVehicleForBooking } from "@/lib/partnerDb";
import { RequestTimer } from "@/lib/perf";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = new RequestTimer("GET /api/bookings");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const bookings = await getBookingsForUser(session.userId);
  timer.mark("customer bookings query");
  timer.total();
  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  const timer = new RequestTimer("POST /api/bookings");
  const session = readSessionFromCookies();
  timer.mark("authentication");
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid booking payload" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
  const rentalMode = body.rentalMode === "Hourly" ? "Hourly" : "Daily";
  const quantity = Math.max(1, Math.round(Number(body.quantity) || 1));

  if (!id || !vehicleId) {
    return NextResponse.json({ error: "Invalid booking payload" }, { status: 400 });
  }

  const pickupMs = Date.parse(body.pickupDateTime);
  const returnMs = Date.parse(body.returnDateTime);
  if (!Number.isFinite(pickupMs) || !Number.isFinite(returnMs) || returnMs <= pickupMs) {
    return NextResponse.json({ error: "Invalid pickup/return date range" }, { status: 400 });
  }

  // These three reads are fully independent of each other (none needs another's
  // result), so they run concurrently instead of as three sequential round trips:
  //  - vehicle: trusted pricing/shop info, never taken from the request body — every
  //    price and shop/display field below comes from the vehicle's actual current
  //    listing, so a crafted request can't book at a tampered price.
  //  - availability: an early, best-effort stock check for a fast/friendly error on
  //    the common case — NOT the thing that actually prevents overbooking (that's the
  //    atomic, lock-protected check inside createPartnerBooking below); this one can
  //    be a request or two stale under heavy concurrent load and that's fine, since
  //    the authoritative check still runs right before the insert.
  //  - user: needed for the customer name/phone mirrored into the shop owner's booking.
  const [vehicle, availability, user] = await Promise.all([
    getVehicleForBooking(vehicleId),
    getVehicleAvailability(vehicleId),
    getUserById(session.userId),
  ]);
  timer.mark("vehicle + availability + user lookup (parallel)");

  if (!vehicle) {
    return NextResponse.json({ error: "This vehicle is no longer available." }, { status: 404 });
  }

  if (availability && availability.availableStock < quantity) {
    return NextResponse.json(
      {
        error:
          availability.availableStock <= 0
            ? "Sorry, this vehicle just got booked out by someone else. Please pick another."
            : `Only ${availability.availableStock} unit${availability.availableStock > 1 ? "s" : ""} left now — please lower the quantity and try again.`,
      },
      { status: 409 }
    );
  }

  const days = rentalMode === "Daily" ? Math.max(1, Math.ceil((returnMs - pickupMs) / (1000 * 60 * 60 * 24))) : 0;
  const hours = rentalMode === "Hourly" ? Math.max(1, Math.round((returnMs - pickupMs) / (1000 * 60 * 60))) : 0;
  const rentalCost = (rentalMode === "Daily" ? days * vehicle.pricePerDay : hours * vehicle.pricePerHour) * quantity;
  const securityDeposit = vehicle.securityDeposit * quantity;

  // Defense in depth against a vehicle priced below MIN_ONLINE_PAYMENT_RUPEES: portalPartner's
  // own listing form/API already reject a new price that low, but this also protects
  // against any listing already in the database from before that validation existed (or
  // priced this low by a direct DB edit) — sending a customer into a UPI payment this
  // small risks their bank silently rejecting it as a fraud-probe pattern (see
  // MIN_ONLINE_PAYMENT_RUPEES's own doc comment), which looks like a broken booking flow
  // rather than a pricing problem. Caught here, before either booking record is created,
  // rather than leaving the customer stuck mid-payment with no way to complete it.
  if (rentalCost < MIN_ONLINE_PAYMENT_RUPEES) {
    return NextResponse.json(
      {
        error: `This vehicle's price is too low to pay online (minimum ₹${MIN_ONLINE_PAYMENT_RUPEES}) — please contact the shop or try another vehicle.`,
      },
      { status: 422 }
    );
  }

  const trustedBooking: Booking = {
    id,
    vehicleId,
    vehicleName: vehicle.name,
    vehicleImage: vehicle.image,
    vehiclePhoto: vehicle.photo,
    city: vehicle.city as Booking["city"],
    category: vehicle.category as Booking["category"],
    shop: {
      name: vehicle.shopName,
      address: vehicle.shopAddress,
      phone: vehicle.shopPhone,
      latitude: vehicle.shopLatitude,
      longitude: vehicle.shopLongitude,
    },
    rentalMode,
    pickupDateTime: new Date(pickupMs).toISOString(),
    returnDateTime: new Date(returnMs).toISOString(),
    days,
    hours,
    quantity,
    pricePerDay: vehicle.pricePerDay,
    pricePerHour: vehicle.pricePerHour,
    rentalCost,
    securityDeposit,
    totalPayableOnline: rentalCost,
    totalPayableAtShop: securityDeposit,
    status: "Upcoming",
    paymentStatus: "Pending",
    createdAt: new Date().toISOString(),
  };

  // Mirror into the shop owner's portal FIRST so we have its id to link back. This is
  // also the authoritative, race-proof stock check (re-verified atomically at insert
  // time, not just the best-effort read above) — on "sold_out" the vehicle's last unit
  // was claimed by someone else between the check above and now, so we must NOT create
  // the customer's own booking either. Every other outcome is safe to proceed past:
  // if this vehicle just isn't partner-listed, or the mirror write itself fails, the
  // customer's own booking (source of truth for this app) still gets created below,
  // just without a linked owner-side record.
  //
  // `user` came from the parallel lookup above, not a fresh query here — same data,
  // one less round trip. `vehicle.ownerId` likewise reuses the getVehicleForBooking()
  // result instead of createPartnerBooking() re-checking owner-approval itself (see its
  // doc comment for why that's still exactly as safe).
  const mirrorResult = user
    ? await createPartnerBooking({
        vehicleId,
        ownerId: vehicle.ownerId,
        customerName: user.name,
        customerPhone: user.phone,
        userId: user.id,
        pickupDateTime: trustedBooking.pickupDateTime,
        returnDateTime: trustedBooking.returnDateTime,
        quantity,
        totalAmount: trustedBooking.totalPayableOnline,
      })
    : { status: "not_applicable" as const };
  timer.mark("partner mirror + atomic stock check (locked transaction)");

  if (mirrorResult.status === "sold_out") {
    timer.total();
    return NextResponse.json(
      { error: "Sorry, this vehicle just got booked out by someone else. Please pick another." },
      { status: 409 }
    );
  }
  const partnerBookingId = mirrorResult.status === "ok" ? mirrorResult.partnerBookingId : null;

  const booking = await createCustomerBooking(session.userId, trustedBooking, partnerBookingId);
  timer.mark("customer booking insert");
  timer.total();

  return NextResponse.json({ booking }, { status: 201 });
}
