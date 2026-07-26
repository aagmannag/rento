import { NextRequest, NextResponse } from "next/server";
import { findAdminByEmailWithHash } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { signSession, setSessionCookie } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  const ip = getClientIp(req);
  // Admin compromise is the highest-value target in this system, so this is the
  // tightest limit of the three apps: fewer attempts per account, and per IP overall.
  const perAccount = rateLimit(`admin-login:${ip}:${email}`, 5, 10 * 60 * 1000);
  const perIp = rateLimit(`admin-login-ip:${ip}`, 15, 10 * 60 * 1000);
  if (!perAccount.allowed || !perIp.allowed) {
    const retryAfter = Math.max(perAccount.retryAfterSeconds ?? 0, perIp.retryAfterSeconds ?? 0);
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Same generic message either way — distinguishing "no such account" from "wrong
  // password" lets an attacker enumerate which emails are registered admins.
  const genericError = () => NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  const admin = await findAdminByEmailWithHash(email);
  if (!admin) {
    // Still runs a bcrypt compare against a dummy hash so response time doesn't itself
    // leak whether the email exists.
    await comparePassword(password, "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Kp0Nn2tsRDVQ2K6P1ZTPYnV1eNJ0i");
    return genericError();
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) return genericError();

  const token = signSession({ adminId: admin.id, email: admin.email });
  setSessionCookie(token);

  const { passwordHash: _drop, ...safeAdmin } = admin;
  return NextResponse.json({ admin: safeAdmin });
}
