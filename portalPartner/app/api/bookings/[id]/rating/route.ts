import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { submitCustomerRating } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = await submitCustomerRating(params.id, session.ownerId, body?.stars, body?.comment);

  if (!result.ok) {
    const status = result.error === "Booking not found" ? 404 : result.error?.includes("already rated") || result.error?.includes("eligible") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ rating: result.rating });
}
