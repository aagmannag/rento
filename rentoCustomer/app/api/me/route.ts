import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getUserById } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  try {
    const dbUser = await getUserById(session.userId);
    if (dbUser) {
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
  } catch {
    // If the local database is unavailable, fall back to the authenticated session so
    // login still works in development.
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      phone: session.phone,
      name: "Rento User",
      gender: null,
      city: null,
    },
  });
}
