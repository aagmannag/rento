import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { createCustomerBooking, getBookingsForUser, getUserById } from "@/lib/db";
import { createPartnerBooking, getVehicleAvailability, getVehicleForBooking } from "@/lib/partnerDb";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const bookings = await getBookingsForUser(session.userId);
  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  const session = readSessionFromCookies();
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

  // Every price and shop/display field below comes from the vehicle's actual current
  // listing, never from the request body — the client only gets to choose the vehicle,
  // dates, mode and quantity. Trusting client-supplied prices here would let anyone book
  // any vehicle for whatever amount they type into the request (e.g. totalPayableOnline).
  const vehicle = await getVehicleForBooking(vehicleId);
  if (!vehicle) {
    return NextResponse.json({ error: "This vehicle is no longer available." }, { status: 404 });
  }

  // Authoritative, server-side stock check — reflects bookings placed by ANY customer
  // in ANY browser/session up to this exact moment, not just whatever the client had
  // loaded. This is what actually prevents overbooking; a client-side check alone
  // can always be stale or bypassed.
  const availability = await getVehicleAvailability(vehicleId);
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
  const user = await getUserById(session.userId);
  const mirrorResult = user
    ? await createPartnerBooking({
        vehicleId,
        customerName: user.name,
        customerPhone: user.phone,
        pickupDateTime: trustedBooking.pickupDateTime,
        returnDateTime: trustedBooking.returnDateTime,
        quantity,
        totalAmount: trustedBooking.totalPayableOnline,
      })
    : { status: "not_applicable" as const };

  if (mirrorResult.status === "sold_out") {
    return NextResponse.json(
      { error: "Sorry, this vehicle just got booked out by someone else. Please pick another." },
      { status: 409 }
    );
  }
  const partnerBookingId = mirrorResult.status === "ok" ? mirrorResult.partnerBookingId : null;

  const booking = await createCustomerBooking(session.userId, trustedBooking, partnerBookingId);

  return NextResponse.json({ booking }, { status: 201 });
}
