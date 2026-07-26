import { assertPublicHost } from "./remoteImageFetch";

/**
 * Confirms a photo URL actually serves an image before we save it — a client-side
 * preview check can be bypassed or can race the form submit, so this is the
 * authoritative check. Relative paths are trusted as-is since those only ever come
 * from our own /api/upload endpoint, never from user-typed input.
 */
export async function isReachableImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  if (!/^https?:\/\//i.test(url)) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // SSRF guard — this runs against whatever a shop owner submits in a raw API call
  // (not just what the UI sends), so it must never fetch a private/internal address
  // on their behalf, same as /api/upload/from-url.
  try {
    await assertPublicHost(parsed.hostname);
  } catch {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Manual redirects — a redirect could repoint at an internal address, so we treat
    // any redirect as "not a valid direct image link" rather than blindly following it.
    let res = await fetch(parsed.toString(), { method: "HEAD", redirect: "manual", signal: controller.signal });
    // Some servers don't support HEAD (405/501) — retry with a ranged GET so we don't
    // download the whole file just to check its type.
    if (!res.ok || res.status === 405 || res.status === 501) {
      res = await fetch(parsed.toString(), {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "manual",
        signal: controller.signal,
      });
    }
    if (res.status >= 300 && res.status < 400) return false;
    if (!res.ok && res.status !== 206) return false;

    const contentType = res.headers.get("content-type") ?? "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
