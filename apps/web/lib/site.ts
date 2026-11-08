// Canonical public base URL for SEO metadata (robots, sitemap, metadataBase).
// Resolved server-side at request time: build-time NEXT_PUBLIC_SITE_URL wins, then the
// deployment's runtime DECOYR_PUBLIC_URL (set by the VM's decoyr-env and passed to the web
// container), then a neutral placeholder so no specific VM IP is ever baked into the image.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.DECOYR_PUBLIC_URL ??
  "https://decoyr.local"
).replace(/\/$/, "");
