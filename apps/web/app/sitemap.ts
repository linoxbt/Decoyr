import type { MetadataRoute } from "next";
import { DOCS_FLAT } from "@/components/docs/nav";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://108-61-245-158.sslip.io").replace(/\/$/, "");
const PAGES = ["", ...DOCS_FLAT.map((l) => l.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
