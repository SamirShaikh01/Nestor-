import type { NextConfig } from "next";

// Security headers (see docs/security-audit.md Finding 5). Applied to every
// route via the top-level headers() hook — this app has no middleware.ts
// and no custom server, so this is the only place to set these globally.
const CSP = [
  "default-src 'self'",
  // Next.js hydration/runtime scripts are self-hosted; the one inline
  // script (app/layout.tsx, theme + accent-color bootstrap) needs
  // 'unsafe-inline' since it intentionally runs before paint and isn't
  // nonce-able without a custom server to generate one per request.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind/Next inject styles at runtime, and globals.css pulls Google
  // Fonts' stylesheet directly — both need style-src 'unsafe-inline' /
  // fonts.googleapis.com.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // Supabase REST + Realtime (websocket) endpoints.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
