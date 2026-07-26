import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { rejectOwner } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json({ error: "Provide a brief reason so the owner knows what to fix" }, { status: 400 });
  }

  const owner = await rejectOwner(params.id, reason);
  if (!owner) {
    return NextResponse.json({ error: "Shop owner not found or cannot be rejected from its current status" }, { status: 404 });
  }
  return NextResponse.json({ owner });
}
