import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getAdminById } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ admin: null });

  try {
    const admin = await getAdminById(session.adminId);
    return NextResponse.json({ admin });
  } catch (err) {
    // The JWT signature already proved this session is genuine — a DB error here (a
    // transient Neon connection drop, observed live during testing) means we can't
    // confirm the admin's current profile, not that they're logged out. Returning
    // { admin: null } here would be indistinguishable from a real "no session" to the
    // client and force an unnecessary logout; 503 lets providers.tsx retry instead.
    console.error("Failed to load admin for session check:", err);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
  }
}
