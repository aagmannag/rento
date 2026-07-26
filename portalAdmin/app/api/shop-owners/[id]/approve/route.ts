import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { approveOwner } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await approveOwner(params.id);
  if (!owner) {
    return NextResponse.json({ error: "Shop owner not found or already approved" }, { status: 404 });
  }
  return NextResponse.json({ owner });
}
