import { NextRequest, NextResponse } from "next/server";
import { createShopOwner, findOwnerByEmailWithHash } from "@/lib/db";
import { hashPassword, isValidEmail, isValidPhone, isValidPincode, passwordIssue } from "@/lib/auth";
import { signSession, setSessionCookie } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const ownerName = String(body.ownerName ?? "").trim();
  const shopName = String(body.shopName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim();
  const city = String(body.city ?? "").trim();
  const address = String(body.address ?? "").trim();
  const pincode = body.pincode ? String(body.pincode).trim() : null;

  if (ownerName.length < 2) {
    return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
  }
  if (shopName.length < 2) {
    return NextResponse.json({ error: "Enter your shop/business name" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const pwIssue = passwordIssue(password);
  if (pwIssue) {
    return NextResponse.json({ error: pwIssue }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ error: "Select the city you operate in" }, { status: 400 });
  }
  if (address.length < 10) {
    return NextResponse.json(
      { error: "Enter the full pickup address customers will collect vehicles from" },
      { status: 400 }
    );
  }
  if (pincode && !isValidPincode(pincode)) {
    return NextResponse.json({ error: "Enter a valid 6-digit pincode" }, { status: 400 });
  }

  const existing = await findOwnerByEmailWithHash(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try logging in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const owner = await createShopOwner({
    ownerName,
    shopName,
    email,
    passwordHash,
    phone,
    city,
    address,
    pincode,
  });

  const token = signSession({ ownerId: owner.id, email: owner.email });
  setSessionCookie(token);

  return NextResponse.json({ owner }, { status: 201 });
}
