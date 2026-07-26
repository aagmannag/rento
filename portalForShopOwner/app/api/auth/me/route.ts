import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getOwnerById } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ owner: null });

  const owner = await getOwnerById(session.ownerId);
  return NextResponse.json({ owner });
}
