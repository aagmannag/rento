import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { updateUserProfile } from "@/lib/db";

export async function PATCH(request: Request) {
  const session = readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, gender, city } = body as { name?: string; gender?: string; city?: string };

  const dbUser = await updateUserProfile(session.userId, { name, gender, city });

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
