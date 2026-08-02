// Content-Security-Policy scoped to what this app actually loads: arbitrary https image
// URLs (shop owners paste external photo links) and blob: previews while a photo upload
// is in flight. The pickup-location map/geocoding lives in the admin portal now, not
// here, so this app needs no map-tile/geocoding hosts allowlisted.
//
// 'unsafe-eval' is added ONLY outside production: Next.js dev mode's Fast Refresh /
// webpack HMR compiles modules with eval()-based source maps, which a strict CSP
// otherwise silently blocks — the page then never hydrates (stuck on the server-
// rendered loading state) with no error visible outside the browser console. Next.js
// never uses eval() in a production build, so prod stays fully locked down.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'" + (isDev ? " ws:" : ""),
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Owners can paste an arbitrary web image URL for a vehicle photo, so there's no
    // fixed set of remote hosts to allowlist — skip the image optimizer for those.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
