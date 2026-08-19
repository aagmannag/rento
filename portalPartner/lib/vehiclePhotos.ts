import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { isReachableImageUrl } from "./imageCheck";
import { isCloudinaryConfigured, uploadImageBuffer } from "./cloudinary";

export const MAX_VEHICLE_PHOTOS = 6;


/** Shared by /api/upload and /api/upload/from-url: normalizes any source image (upload
 *  or a fetched external URL) into the same consistent asset — rotated, cropped to a
 *  standard 4:3 canvas, and re-encoded as webp — so every vehicle photo looks and loads
 *  the same regardless of where it came from.
 *
 *  Stored on Cloudinary when CLOUDINARY_* env vars are set — required for any deploy
 *  target with an ephemeral filesystem (Vercel, most serverless hosts), since a locally
 *  written file wouldn't survive past that request. Falls back to public/uploads on
 *  local disk otherwise, so local dev needs no Cloudinary account to work. */
export async function saveVehiclePhoto(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 1280, height: 960, fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  if (isCloudinaryConfigured()) {
    return uploadImageBuffer(resized, "rento/vehicles");
  }

  const filename = `${randomUUID()}.webp`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "vehicles");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), resized);
  return `/uploads/vehicles/${filename}`;
}

/** Shared by the create/update vehicle routes: normalizes the raw photoUrls input and
 *  checks each URL actually resolves to an image, reporting precisely which one(s) are bad. */
export async function validatePhotoUrls(input: unknown): Promise<{ urls: string[] } | { error: string }> {
  if (!Array.isArray(input)) return { error: "photoUrls must be a list of image URLs" };

  // Dedupe (e.g. the same uploaded file added twice by mistake) while preserving order —
  // the first occurrence keeps its position, which matters since index 0 is the cover.
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of input) {
    const url = String(raw ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  if (urls.length > MAX_VEHICLE_PHOTOS) {
    return { error: `You can add up to ${MAX_VEHICLE_PHOTOS} photos per vehicle.` };
  }

  const checks = await Promise.all(urls.map((url) => isReachableImageUrl(url)));
  const badIndexes = checks.map((ok, i) => (ok ? -1 : i)).filter((i) => i >= 0);
  if (badIndexes.length > 0) {
    return {
      error:
        badIndexes.length === urls.length
          ? "None of the photo links lead to a valid image. Please re-upload or re-check the links."
          : `Photo ${badIndexes.map((i) => i + 1).join(", ")} doesn't lead to a valid image — please re-upload or fix the link.`,
    };
  }

  return { urls };
}
