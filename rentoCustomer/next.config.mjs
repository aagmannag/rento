// Content-Security-Policy scoped to what this app actually loads: Firebase phone-auth's
// invisible reCAPTCHA widget (loads a script + iframe from Google), a Google Maps embed
// iframe for pickup locations, Firebase's own API calls, and arbitrary https photo URLs
// (vehicle/city images can point at any external host by design).
//
// 'unsafe-eval' is added ONLY outside production: Next.js dev mode's Fast Refresh /
// webpack HMR compiles modules with eval()-based source maps, which a strict CSP
// otherwise silently blocks — the page then never hydrates (stuck on the server-
// rendered loading state) with no error visible outside the browser console. Next.js
// never uses eval() in a production build, so prod stays fully locked down.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  // Partner vehicle photos uploaded as files resolve to an absolute cross-origin URL at
  // PARTNER_PORTAL_ORIGIN (http://localhost:3001 by default in dev — plain http, not
  // https) — img-src needs the http: scheme too in dev, or those photos silently fail
  // to load here even though they display fine on the partner portal itself.
  `img-src 'self' data: blob: https:${isDev ? " http:" : ""}`,
  "font-src 'self' data:",
  // Firebase Auth talks to several googleapis.com/firebaseio.com subdomains — allowing
  // https: broadly here avoids brittle, hard-to-diagnose CSP breakage of login.
  "connect-src 'self' https:" + (isDev ? " ws:" : ""),
  "frame-src https://www.google.com https://www.recaptcha.net",
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
  // Disabled: Firebase's RecaptchaVerifier widget (used for phone-auth login) manages
  // its own DOM outside React's control and breaks under Strict Mode's intentional
  // double-mount-in-dev behavior — surfaces as "Cannot read properties of null" errors
  // from Google's recaptcha script while solving the challenge. Only affects dev mode;
  // production builds never double-invoke regardless of this setting.
  reactStrictMode: false,
  images: {
    // Partner-listed vehicle photos can point at the portal app's own /uploads path
    // or at an arbitrary web image URL the shop owner pasted in — both are unpredictable
    // hosts, so skip the Next.js image optimizer's domain allowlist entirely here.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
