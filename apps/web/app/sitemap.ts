import type { MetadataRoute } from "next";
import { DOCS_FLAT } from "@/components/docs/nav";
import { SITE_URL } from "@/lib/site";

const PAGES = ["", ...DOCS_FLAT.map((l) => l.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
