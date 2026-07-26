import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { updateOwnerLocation } from "@/lib/db";

/** Marking a shop's precise pickup location is an admin-only action — shop owners can
 *  only ever type their address (see portalForShopOwner's shop-profile page). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  if (body.clear === true) {
    const owner = await updateOwnerLocation(params.id, null, null);
    if (!owner) return NextResponse.json({ error: "Shop owner not found" }, { status: 404 });
    return NextResponse.json({ owner });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
  }

  const owner = await updateOwnerLocation(params.id, latitude, longitude);
  if (!owner) return NextResponse.json({ error: "Shop owner not found" }, { status: 404 });
  return NextResponse.json({ owner });
}
