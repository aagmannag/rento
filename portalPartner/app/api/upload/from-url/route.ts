import { NextRequest, NextResponse } from "next/server";
import sharp, { type Metadata } from "sharp";
import { readSessionFromCookies } from "@/lib/session";
import { fetchRemoteImageBuffer } from "@/lib/remoteImageFetch";
import { saveVehiclePhoto } from "@/lib/vehiclePhotos";

/**
 * Turns a shop owner's pasted image link into the same kind of asset a direct file
 * upload produces — fetched server-side (with SSRF/size/timeout guards), verified to
 * actually be a valid image, then resized/re-encoded identically to /api/upload.
 * Every vehicle photo goes through the same sharp pipeline regardless of source,
 * so output is always a consistent 1280×960 WebP regardless of the input size.
 */
export async function POST(req: NextRequest) {
  const session = readSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "No image URL provided" }, { status: 400 });

  const fetched = await fetchRemoteImageBuffer(url);
  if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: 400 });

  let metadata: Metadata;
  try {
    metadata = await sharp(fetched.buffer).metadata();
  } catch {
    return NextResponse.json(
      { error: "Couldn't process that image — try a JPG, PNG or WEBP link instead." },
      { status: 400 }
    );
  }
  if (!metadata.width || !metadata.height) {
    return NextResponse.json(
      { error: "Couldn't read that image's dimensions — try a different link." },
      { status: 400 }
    );
  }

  const savedUrl = await saveVehiclePhoto(fetched.buffer);
  return NextResponse.json({ url: savedUrl }, { status: 201 });
}
