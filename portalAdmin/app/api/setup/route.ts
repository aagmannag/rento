import { NextRequest, NextResponse } from "next/server";
import { adminCount, createFirstAdmin } from "@/lib/db";
import { hashPassword, isValidEmail, passwordIssue } from "@/lib/auth";
import { signSession, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await adminCount();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req: NextRequest) {
  const count = await adminCount();
  if (count > 0) {
    return NextResponse.json(
      { error: "An admin account already exists. Please log in instead." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (name.length < 2) return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const pwIssue = passwordIssue(password);
  if (pwIssue) return NextResponse.json({ error: pwIssue }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const admin = await createFirstAdmin({ name, email, passwordHash });

  const token = signSession({ adminId: admin.id, email: admin.email });
  setSessionCookie(token);

  return NextResponse.json({ admin }, { status: 201 });
}
