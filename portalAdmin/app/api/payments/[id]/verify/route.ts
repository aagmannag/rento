import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { verifyPayment } from "@/lib/paymentsDb";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ok = await verifyPayment(params.id);
  if (!ok) return NextResponse.json({ error: "Payment not found or already reviewed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
