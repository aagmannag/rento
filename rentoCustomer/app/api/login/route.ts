import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { findOrCreateUserByPhone } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

function hasFirebaseAdminCredentials() {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

function isLocalRequest(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  // Firebase itself governs OTP send/verify attempts — this is just a backstop against
  // one IP hammering our own token-verification + DB lookup with junk tokens.
  const limit = rateLimit(`login:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { idToken, phoneNumber, devMode } = await request.json().catch(() => ({
    idToken: null,
    phoneNumber: null,
    devMode: false,
  }));

  let decoded;
  try {
    if (hasFirebaseAdminCredentials()) {
      if (!idToken || typeof idToken !== "string") {
        return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
      }
      decoded = await adminAuth().verifyIdToken(idToken);
    } else if (isLocalRequest(request)) {
      if (typeof phoneNumber !== "string" || !/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
        return NextResponse.json(
          { error: "Login needs a verified phone number in dev mode when Firebase Admin credentials are missing." },
          { status: 400 }
        );
      }
      if (!devMode && (!idToken || typeof idToken !== "string")) {
        return NextResponse.json(
          { error: "Missing idToken" },
          { status: 400 }
        );
      }
      console.warn("Using dev-only Firebase login fallback because Admin credentials are missing.");
      decoded = { phone_number: phoneNumber };
    } else {
      return NextResponse.json(
        { error: "Login isn't fully set up yet on the server (missing Firebase Admin credentials)." },
        { status: 500 }
      );
    }
  } catch (err) {
    // Missing/misconfigured Admin SDK credentials is a setup problem, not something
    // caused by the user's login attempt — surface that distinctly rather than as a
    // generic "your code was wrong" message.
    if (err instanceof Error && err.message.includes("Firebase Admin credentials are missing")) {
      console.error(err.message);
      return NextResponse.json(
        { error: "Login isn't fully set up yet on the server (missing Firebase Admin credentials)." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const phone = decoded.phone_number;
  if (!phone) {
    return NextResponse.json({ error: "Token has no verified phone number" }, { status: 400 });
  }

  let dbUser;
  try {
    dbUser = await findOrCreateUserByPhone(phone);
  } catch (err) {
    if (!isLocalRequest(request)) {
      throw err;
    }
    console.warn("Using local auth fallback because the users database is unavailable:", err);
    dbUser = {
      id: phone,
      phone,
      name: "Rento User",
      gender: null,
      city: null,
    };
  }

  const token = signSession({ userId: dbUser.id, phone: dbUser.phone });
  setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: dbUser.id,
      phone: dbUser.phone,
      name: dbUser.name,
      gender: dbUser.gender,
      city: dbUser.city,
    },
  });
}
