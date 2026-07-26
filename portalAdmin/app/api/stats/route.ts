import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getPlatformStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stats = await getPlatformStats();
  return NextResponse.json({ stats });
}
