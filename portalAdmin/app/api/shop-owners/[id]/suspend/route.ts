import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { suspendOwner } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await suspendOwner(params.id);
  if (!owner) {
    return NextResponse.json({ error: "Only an approved shop owner can be suspended" }, { status: 404 });
  }
  return NextResponse.json({ owner });
}
