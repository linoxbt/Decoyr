import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://decoyr.vercel.app").replace(/\/$/, "");
const PAGES = ["", "/product", "/how-it-works", "/scenarios", "/security", "/use-cases", "/architecture", "/docs", "/faq", "/about"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
