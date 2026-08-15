import { NextRequest, NextResponse } from "next/server";
import { MIN_ONLINE_PAYMENT_RUPEES } from "@rento/db";
import { readSessionFromCookies } from "@/lib/session";
import { createVehicle, getVehiclesForOwner } from "@/lib/db";
import { validatePhotoUrls } from "@/lib/vehiclePhotos";
import { RequestTimer } from "@/lib/perf";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = ["Scooty", "Bike", "Car"];

// Owner's own vehicle list — hit on every dashboard load/poll, same threshold
// reasoning as the bookings route.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/vehicles");
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  timer.mark("auth");

  const vehicles = await getVehiclesForOwner(session.ownerId);
  timer.mark("db");
  const response = NextResponse.json({ vehicles });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return response;
}

export async function POST(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const category = String(body.category ?? "") as Category;
  const name = String(body.name ?? "").trim();
  const brand = String(body.brand ?? "").trim();
  const engineLabel = String(body.engineLabel ?? "").trim();
  const pricePerDay = Number(body.pricePerDay);
  const pricePerHour = Number(body.pricePerHour);
  const securityDeposit = Number(body.securityDeposit);
  const stock = Number(body.stock);
  const fuel = String(body.fuel ?? "Petrol");
  const transmission = String(body.transmission ?? "Manual");
  const seats = Number(body.seats ?? 2);
  const mileage = String(body.mileage ?? "").trim();
  const features = Array.isArray(body.features) ? body.features.map(String).filter(Boolean) : [];
  const description = body.description ? String(body.description).trim() : null;
  const city = String(body.city ?? "").trim();

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Select a valid vehicle category" }, { status: 400 });
  }
  if (name.length < 2) return NextResponse.json({ error: "Enter the vehicle model name" }, { status: 400 });
  if (brand.length < 2) return NextResponse.json({ error: "Enter the vehicle brand" }, { status: 400 });
  // Below MIN_ONLINE_PAYMENT_RUPEES, a customer booking just this vehicle for a single
  // day/hour would be sent to pay a UPI amount small enough that banks commonly flag it
  // as a fraud-probe pattern and silently reject it (see MIN_ONLINE_PAYMENT_RUPEES's own
  // doc comment) — the booking would look broken to a genuine customer, not caused by
  // anything wrong with their payment.
  if (!Number.isFinite(pricePerDay) || pricePerDay < MIN_ONLINE_PAYMENT_RUPEES) {
    return NextResponse.json(
      { error: `Enter a daily price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}` },
      { status: 400 }
    );
  }
  if (!Number.isFinite(pricePerHour) || pricePerHour < MIN_ONLINE_PAYMENT_RUPEES) {
    return NextResponse.json(
      { error: `Enter an hourly price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}` },
      { status: 400 }
    );
  }
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
    return NextResponse.json({ error: "Enter a valid security deposit" }, { status: 400 });
  }
  if (!Number.isFinite(stock) || stock < 1) {
    return NextResponse.json({ error: "Stock must be at least 1 unit" }, { status: 400 });
  }
  if (!mileage) return NextResponse.json({ error: "Enter the mileage / range" }, { status: 400 });
  if (!city) return NextResponse.json({ error: "Select the city this vehicle is listed in" }, { status: 400 });

  const photoResult = await validatePhotoUrls(body.photoUrls);
  if ("error" in photoResult) return NextResponse.json({ error: photoResult.error }, { status: 400 });
  if (photoResult.urls.length === 0) {
    return NextResponse.json({ error: "Add at least one photo of the vehicle" }, { status: 400 });
  }

  const vehicle = await createVehicle({
    ownerId: session.ownerId,
    category,
    name,
    brand,
    engineLabel,
    photoUrls: photoResult.urls,
    pricePerDay: Math.round(pricePerDay),
    pricePerHour: Math.round(pricePerHour),
    securityDeposit: Math.round(securityDeposit),
    stock: Math.round(stock),
    fuel,
    transmission,
    seats: category === "Car" ? Math.round(seats) : 2,
    mileage,
    features,
    description,
    city,
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}
