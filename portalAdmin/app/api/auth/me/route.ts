import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getAdminById } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ admin: null });

  const admin = await getAdminById(session.adminId);
  return NextResponse.json({ admin });
}
