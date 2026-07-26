import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { resubmitOwnerForReview } from "@/lib/db";

export async function POST() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await resubmitOwnerForReview(session.ownerId);
  if (!owner) {
    return NextResponse.json(
      { error: "Only a rejected application can be resubmitted for review." },
      { status: 400 }
    );
  }
  return NextResponse.json({ owner });
}
