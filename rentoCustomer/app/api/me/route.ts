import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getUserById } from "@/lib/db";
import { RequestTimer } from "@/lib/perf";

// Polled every 20s per logged-in tab (see providers.tsx) — see getUserById's own doc
// comment for why this was worth caching. Only log when still slow despite the cache
// (a cold cache entry or Redis being unavailable), not on every poll.
const SLOW_REQUEST_THRESHOLD_MS = 300;

export async function GET() {
  const timer = new RequestTimer("GET /api/me");
  const session = readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  timer.mark("auth");

  try {
    const dbUser = await getUserById(session.userId);
    timer.mark("db");
    if (dbUser) {
      const response = NextResponse.json({
        user: {
          id: dbUser.id,
          phone: dbUser.phone,
          name: dbUser.name,
          gender: dbUser.gender,
          city: dbUser.city,
          rating: dbUser.rating,
        },
      });
      timer.total(SLOW_REQUEST_THRESHOLD_MS);
      return response;
    }
  } catch {
    // If the local database is unavailable, fall back to the authenticated session so
    // login still works in development.
  }

  const fallback = NextResponse.json({
    user: {
      id: session.userId,
      phone: session.phone,
      name: "Rento User",
      gender: null,
      city: null,
      rating: null,
    },
  });
  timer.total(SLOW_REQUEST_THRESHOLD_MS);
  return fallback;
}
