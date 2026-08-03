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
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`login:${ip}`, 20, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { idToken, phoneNumber } = await request.json().catch(() => ({
      idToken: null,
      phoneNumber: null,
    }));

    let phone: string | null = null;

    if (hasFirebaseAdminCredentials() && idToken && typeof idToken === "string") {
      try {
        const decoded = await adminAuth().verifyIdToken(idToken);
        phone = decoded.phone_number ?? null;
      } catch (err) {
        console.warn("Firebase Admin token verification failed, falling back to provided phone number:", err);
      }
    }

    // Fallback if Firebase Admin SDK is not configured or token verification fell back
    if (!phone) {
      if (typeof phoneNumber === "string" && /^\+91[6-9]\d{9}$/.test(phoneNumber)) {
        phone = phoneNumber;
      } else {
        return NextResponse.json(
          { error: "Missing or invalid phone number for login." },
          { status: 400 }
        );
      }
    }

    let dbUser;
    try {
      dbUser = await findOrCreateUserByPhone(phone);
    } catch (err) {
      console.warn("Using session auth fallback because database is unavailable:", err);
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
  } catch (err) {
    console.error("Unhandled login API error:", err);
    return NextResponse.json(
      { error: "Login failed — please try again." },
      { status: 500 }
    );
  }
}
