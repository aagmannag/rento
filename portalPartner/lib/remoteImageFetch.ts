import dns from "node:dns/promises";
import net from "node:net";

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // 15MB safety cap before we even try to resize it
const FETCH_TIMEOUT_MS = 30_000; // 30s — enough for slow external hosts / slow connections


function isDisallowedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (also covers cloud metadata endpoints)
    if (a === 0) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("::ffff:")) return isDisallowedIp(lower.slice(7)); // IPv4-mapped IPv6
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  return false;
}

/** Blocks SSRF: a shop owner pasting a link that resolves to localhost, a private LAN
 *  address, or a cloud metadata endpoint must never let our server fetch it on their behalf. */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname.toLowerCase() === "localhost") {
    throw new Error("That URL points to a local address, which isn't allowed.");
  }
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Couldn't resolve that URL's host. Check the link and try again.");
  }
  if (records.length === 0 || records.some((r) => isDisallowedIp(r.address))) {
    throw new Error("That URL points to a private or internal address, which isn't allowed.");
  }
}

export type RemoteImageResult = { ok: true; buffer: Buffer } | { ok: false; error: string };

/** Fetches a user-pasted image URL server-side with SSRF/DoS guards: public-host-only,
 *  no auto-following redirects (a redirect could repoint at an internal address), a
 *  download size cap, and a request timeout. Returns raw bytes for the caller to validate
 *  (dimensions, actual content type) and re-encode — never trust this buffer as-is. */
export async function fetchRemoteImageBuffer(rawUrl: string): Promise<RemoteImageResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http:// or https:// image links are supported." };
  }

  try {
    await assertPublicHost(parsed.hostname);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "That URL isn't allowed." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      redirect: "follow", // many image CDNs redirect before serving — follow them
      signal: controller.signal,
      headers: {
        // Some hosts block or stall requests with no User-Agent (bot detection).
        // A realistic browser string avoids silent timeouts from those servers.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/webp,image/avif,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `Couldn't fetch that image (server responded ${res.status}).` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return { ok: false, error: "That link doesn't point to an image." };
    }

    const lengthHeader = res.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_DOWNLOAD_BYTES) {
      return { ok: false, error: "That image file is too large (max 15MB)." };
    }
    if (!res.body) return { ok: false, error: "Couldn't read that image." };

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_DOWNLOAD_BYTES) {
        controller.abort();
        return { ok: false, error: "That image file is too large (max 15MB)." };
      }
      chunks.push(value);
    }
    return { ok: true, buffer: Buffer.concat(chunks) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Fetching that image took too long. Please try a different link." };
    }
    return { ok: false, error: "Couldn't fetch that image link. Check the URL and try again." };
  } finally {
    clearTimeout(timeout);
  }
}
