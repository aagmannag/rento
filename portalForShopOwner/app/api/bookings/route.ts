import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getBookingsForOwner } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const bookings = await getBookingsForOwner(session.ownerId);
  return NextResponse.json({ bookings });
}
