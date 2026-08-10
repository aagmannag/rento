// Content-Security-Policy scoped to what this app actually loads: arbitrary https photo
// URLs (vehicle photos, payment screenshots), and Leaflet + OpenStreetMap tiles/Nominatim
// geocoding for the interactive pickup-location picker on the shop owner detail page
// (marking the precise pin is an admin-only action — see that page for why).
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
  // Vehicle photos and payment screenshots resolve to absolute cross-origin URLs at
  // PARTNER_PORTAL_ORIGIN/RENTO_CUSTOMER_ORIGIN (http://localhost:* by default in dev —
  // plain http, not https) — img-src needs the http: scheme too in dev, or those images
  // silently fail to load here even though they display fine on their origin app.
  `img-src 'self' data: blob: https:${isDev ? " http:" : ""}`,
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org" + (isDev ? " ws:" : ""),
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
  // @rento/db is a workspace package that ships raw TypeScript (no build step of its
  // own) — Next.js only transpiles source inside this app by default, so packages
  // outside it need to be listed explicitly or imports from it fail to compile.
  transpilePackages: ["@rento/db"],
  images: {
    // Vehicle photos here can come from the portal's /uploads path or an owner-pasted
    // web URL — no fixed set of hosts to allowlist, so skip the image optimizer.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
