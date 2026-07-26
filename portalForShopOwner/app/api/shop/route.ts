import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/session";
import {
  findOwnerByEmailWithHash,
  getOwnerById,
  updateOwnerPassword,
  updateOwnerProfile,
} from "@/lib/db";
import { comparePassword, hashPassword, isValidPhone, isValidPincode, passwordIssue } from "@/lib/auth";

export async function GET() {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const owner = await getOwnerById(session.ownerId);
  return NextResponse.json({ owner });
}

export async function PATCH(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  // Password change is handled separately since it needs the current password verified.
  if (body.currentPassword !== undefined || body.newPassword !== undefined) {
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    const ownerWithHash = await findOwnerByEmailWithHash((await getOwnerById(session.ownerId))?.email ?? "");
    if (!ownerWithHash) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const valid = await comparePassword(currentPassword, ownerWithHash.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const issue = passwordIssue(newPassword);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });

    await updateOwnerPassword(session.ownerId, await hashPassword(newPassword));
    return NextResponse.json({ ok: true });
  }

  const patch: { ownerName?: string; shopName?: string; phone?: string; city?: string; address?: string; pincode?: string | null } = {};

  if (body.ownerName !== undefined) {
    const v = String(body.ownerName).trim();
    if (v.length < 2) return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    patch.ownerName = v;
  }
  if (body.shopName !== undefined) {
    const v = String(body.shopName).trim();
    if (v.length < 2) return NextResponse.json({ error: "Enter your shop/business name" }, { status: 400 });
    patch.shopName = v;
  }
  if (body.phone !== undefined) {
    const v = String(body.phone).trim();
    if (!isValidPhone(v)) return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    patch.phone = v;
  }
  if (body.city !== undefined) {
    const v = String(body.city).trim();
    if (!v) return NextResponse.json({ error: "Select a city" }, { status: 400 });
    patch.city = v;
  }
  if (body.address !== undefined) {
    const v = String(body.address).trim();
    if (v.length < 10) {
      return NextResponse.json(
        { error: "Enter the full pickup address customers will collect vehicles from" },
        { status: 400 }
      );
    }
    patch.address = v;
  }
  if (body.pincode !== undefined) {
    const v = body.pincode ? String(body.pincode).trim() : null;
    if (v && !isValidPincode(v)) return NextResponse.json({ error: "Enter a valid 6-digit pincode" }, { status: 400 });
    patch.pincode = v;
  }

  const owner = await updateOwnerProfile(session.ownerId, patch);
  return NextResponse.json({ owner });
}
