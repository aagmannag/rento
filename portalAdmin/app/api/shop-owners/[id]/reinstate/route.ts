import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { reinstateOwner } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await reinstateOwner(params.id);
  if (!owner) {
    return NextResponse.json({ error: "Only a suspended shop owner can be reinstated" }, { status: 404 });
  }
  return NextResponse.json({ owner });
}
