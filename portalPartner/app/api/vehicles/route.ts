import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { createVehicle, getVehiclesForOwner } from "@/lib/db";
import { validatePhotoUrls } from "@/lib/vehiclePhotos";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = ["Scooty", "Bike", "Car"];

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vehicles = await getVehiclesForOwner(session.ownerId);
  return NextResponse.json({ vehicles });
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
  if (!Number.isFinite(pricePerDay) || pricePerDay <= 0) {
    return NextResponse.json({ error: "Enter a valid daily price" }, { status: 400 });
  }
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
    return NextResponse.json({ error: "Enter a valid hourly price" }, { status: 400 });
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
