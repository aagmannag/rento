import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { readSessionFromCookies } from "@/lib/session";
import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Payment-proof screenshot uploads (UPI payment confirmations).
 *
 * Stored on Cloudinary when CLOUDINARY_* env vars are set — required for any deploy
 * target with an ephemeral filesystem (Vercel, most serverless hosts), since a locally
 * written file wouldn't survive past that request. Falls back to public/uploads on
 * local disk otherwise, so local dev needs no Cloudinary account to work.
 */
export async function POST(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("screenshot");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No screenshot provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG or WEBP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be smaller than 8MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  if (isCloudinaryConfigured()) {
    const url = await uploadImageBuffer(resized, "rento/payments");
    return NextResponse.json({ url }, { status: 201 });
  }

  const filename = `${randomUUID()}.webp`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "payments");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), resized);

  return NextResponse.json({ url: `/uploads/payments/${filename}` }, { status: 201 });
}
