import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { rejectPayment } from "@/lib/paymentsDb";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json({ error: "Provide a brief reason so the customer knows what to fix" }, { status: 400 });
  }

  const ok = await rejectPayment(params.id, reason);
  if (!ok) return NextResponse.json({ error: "Payment not found or already reviewed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
