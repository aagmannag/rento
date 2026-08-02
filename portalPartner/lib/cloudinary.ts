import { v2 as cloudinary } from "cloudinary";

let configured = false;

/** True once all three Cloudinary env vars are set. Lets callers fall back to local-disk
 *  storage in dev/self-hosted setups that haven't configured Cloudinary — deploying to a
 *  host with an ephemeral filesystem is what actually requires it to be set. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

/** Uploads an already-processed image buffer (resized/re-encoded by sharp) to Cloudinary
 *  and returns its permanent, publicly-servable HTTPS URL. Never call this without first
 *  checking isCloudinaryConfigured() — cloudinary.config() with missing credentials fails
 *  at upload time with a confusing error rather than a clear one. */
export function uploadImageBuffer(buffer: Buffer, folder: string): Promise<string> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err || !result) {
          reject(err instanceof Error ? err : new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
