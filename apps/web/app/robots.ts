import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://108-61-245-158.sslip.io").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] }], sitemap: `${BASE}/sitemap.xml` };
}
