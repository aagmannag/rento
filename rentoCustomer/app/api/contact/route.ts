import { NextRequest, NextResponse } from "next/server";
import { createContactMessage } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 2) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (contact.length < 5) {
    return NextResponse.json({ error: "Enter a valid email or phone number" }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Enter a bit more detail so we can help" }, { status: 400 });
  }

  await createContactMessage({ name, contact, message });
  return NextResponse.json({ ok: true }, { status: 201 });
}
