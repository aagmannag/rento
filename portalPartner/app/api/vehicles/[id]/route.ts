import { NextRequest, NextResponse } from "next/server";
import { MIN_ONLINE_PAYMENT_RUPEES } from "@rento/db";
import { readSessionFromCookies } from "@/lib/session";
import { deleteVehicle, getVehicleForOwner, updateVehicle } from "@/lib/db";
import { validatePhotoUrls } from "@/lib/vehiclePhotos";
import type { Category, VehicleStatus } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vehicle = await getVehicleForOwner(params.id, session.ownerId);
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ vehicle });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (body.category !== undefined) patch.category = String(body.category) as Category;
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.brand !== undefined) patch.brand = String(body.brand).trim();
  if (body.engineLabel !== undefined) patch.engineLabel = String(body.engineLabel).trim();
  // Same floor as the create route (POST /api/vehicles) — see MIN_ONLINE_PAYMENT_RUPEES's
  // own doc comment for why. This route previously accepted any finite number here,
  // including 0/negative/near-zero prices with no validation at all.
  if (body.pricePerDay !== undefined) {
    const value = Math.round(Number(body.pricePerDay));
    if (!Number.isFinite(value) || value < MIN_ONLINE_PAYMENT_RUPEES) {
      return NextResponse.json(
        { error: `Enter a daily price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}` },
        { status: 400 }
      );
    }
    patch.pricePerDay = value;
  }
  if (body.pricePerHour !== undefined) {
    const value = Math.round(Number(body.pricePerHour));
    if (!Number.isFinite(value) || value < MIN_ONLINE_PAYMENT_RUPEES) {
      return NextResponse.json(
        { error: `Enter an hourly price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}` },
        { status: 400 }
      );
    }
    patch.pricePerHour = value;
  }
  if (body.securityDeposit !== undefined) patch.securityDeposit = Math.round(Number(body.securityDeposit));
  if (body.stock !== undefined) patch.stock = Math.round(Number(body.stock));
  if (body.fuel !== undefined) patch.fuel = String(body.fuel);
  if (body.transmission !== undefined) patch.transmission = String(body.transmission);
  if (body.seats !== undefined) patch.seats = Math.round(Number(body.seats));
  if (body.mileage !== undefined) patch.mileage = String(body.mileage).trim();
  if (body.features !== undefined) patch.features = Array.isArray(body.features) ? body.features.map(String) : [];
  if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
  if (body.city !== undefined) patch.city = String(body.city).trim();
  if (body.status !== undefined) patch.status = String(body.status) as VehicleStatus;

  if (body.photoUrls !== undefined) {
    const photoResult = await validatePhotoUrls(body.photoUrls);
    if ("error" in photoResult) return NextResponse.json({ error: photoResult.error }, { status: 400 });
    if (photoResult.urls.length === 0) {
      return NextResponse.json({ error: "Add at least one photo of the vehicle" }, { status: 400 });
    }
    patch.photoUrls = photoResult.urls;
  }

  const vehicle = await updateVehicle(params.id, session.ownerId, patch);
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ vehicle });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ok = await deleteVehicle(params.id, session.ownerId);
  if (!ok) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
