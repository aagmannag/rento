import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getUserById } from "@/lib/db";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const dbUser = await getUserById(session.userId);
  if (!dbUser) {
    return NextResponse.json({ user: null });
  }

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
