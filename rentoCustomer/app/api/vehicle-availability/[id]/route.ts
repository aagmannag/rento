import { NextRequest, NextResponse } from "next/server";
import { getVehicleAvailability } from "@/lib/partnerDb";
import { RequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

// Hit right before every booking confirmation (and on a failed booking's retry) — see
// app/booking/[id]/page.tsx — so, like partner-vehicles, only log when it's actually
// slow rather than on every call.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const timer = new RequestTimer("GET /api/vehicle-availability/[id]");
  const availability = await getVehicleAvailability(params.id);
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  if (!availability) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json(availability);
}
