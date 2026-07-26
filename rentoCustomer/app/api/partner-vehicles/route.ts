import { NextResponse } from "next/server";
import { getPartnerVehicles } from "@/lib/partnerDb";

// Must re-run on every request — partner vehicles change frequently and this route has
// no other dynamic API usage, so Next would otherwise cache it as a static response
// generated once at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const vehicles = await getPartnerVehicles();
  return NextResponse.json({ vehicles });
}
