import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getShopOwnerDetail } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await getShopOwnerDetail(params.id);
  if (!owner) return NextResponse.json({ error: "Shop owner not found" }, { status: 404 });
  return NextResponse.json({ owner });
}
