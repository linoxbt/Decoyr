import type { NextConfig } from "next";

const API = process.env.DECOYR_API_URL ?? "http://127.0.0.1:8000";
const STREAM = process.env.NEXT_PUBLIC_DECOYR_STREAM_BASE ?? "";
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self'${STREAM ? " " + STREAM : ""}${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    // Documentation pages moved under /docs; keep old links working.
    return [
      { source: "/how-it-works", destination: "/docs/how-it-works", permanent: true },
      { source: "/scenarios", destination: "/docs/scenarios", permanent: true },
      { source: "/security", destination: "/docs/security", permanent: true },
      { source: "/architecture", destination: "/docs/architecture", permanent: true },
      { source: "/faq", destination: "/docs/faq", permanent: true },
      { source: "/product", destination: "/docs/product", permanent: true },
      { source: "/use-cases", destination: "/docs/use-cases", permanent: true },
      { source: "/about", destination: "/docs/about", permanent: true },
      // The settings page was removed: system status lives on the architecture docs page.
      { source: "/app/settings", destination: "/docs/architecture", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
