import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { listPendingPayments } from "@/lib/paymentsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const payments = await listPendingPayments();
  return NextResponse.json({ payments });
}
