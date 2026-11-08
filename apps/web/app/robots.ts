import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://decoyr.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] }], sitemap: `${BASE}/sitemap.xml` };
}
