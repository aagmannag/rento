import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import { getAdminByIdWithHash, updateAdminPassword } from "@/lib/db";
import { comparePassword, hashPassword, passwordIssue } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  const admin = await getAdminByIdWithHash(session.adminId);
  if (!admin) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const valid = await comparePassword(currentPassword, admin.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const issue = passwordIssue(newPassword);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });

  await updateAdminPassword(session.adminId, await hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
