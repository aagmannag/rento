import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { updateAdminName } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Enter your full name" }, { status: 400 });

  const admin = await updateAdminName(session.adminId, name);
  return NextResponse.json({ admin });
}
