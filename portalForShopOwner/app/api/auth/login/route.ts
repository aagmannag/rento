import { NextRequest, NextResponse } from "next/server";
import { findOwnerByEmailWithHash } from "@/lib/db";
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
  // Two caps: one per IP+email (stops repeated guesses against a single account) and a
  // looser one per IP alone (stops one attacker spraying many different emails).
  const perAccount = rateLimit(`login:${ip}:${email}`, 8, 10 * 60 * 1000);
  const perIp = rateLimit(`login-ip:${ip}`, 30, 10 * 60 * 1000);
  if (!perAccount.allowed || !perIp.allowed) {
    const retryAfter = Math.max(perAccount.retryAfterSeconds ?? 0, perIp.retryAfterSeconds ?? 0);
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Same generic message either way — distinguishing "no such account" from "wrong
  // password" lets an attacker enumerate which emails are registered shop owners.
  const genericError = () => NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  const owner = await findOwnerByEmailWithHash(email);
  if (!owner) {
    // Still runs a bcrypt compare against a dummy hash so the response time doesn't
    // itself leak whether the email exists (a real compare vs. an early return would
    // otherwise be distinguishable by timing).
    await comparePassword(password, "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Kp0Nn2tsRDVQ2K6P1ZTPYnV1eNJ0i");
    return genericError();
  }

  const valid = await comparePassword(password, owner.passwordHash);
  if (!valid) {
    return genericError();
  }

  const token = signSession({ ownerId: owner.id, email: owner.email });
  setSessionCookie(token);

  const { passwordHash: _drop, ...safeOwner } = owner;
  return NextResponse.json({ owner: safeOwner });
}
