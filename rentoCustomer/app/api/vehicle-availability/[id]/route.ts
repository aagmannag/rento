import { NextRequest, NextResponse } from "next/server";
import { getVehicleAvailability } from "@/lib/partnerDb";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const availability = await getVehicleAvailability(params.id);
  if (!availability) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json(availability);
}
