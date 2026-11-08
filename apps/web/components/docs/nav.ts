export type DocLink = { href: string; title: string };
export type DocGroup = { title: string; links: DocLink[] };

/** Single source of truth for the docs sidebar, breadcrumbs and previous/next links. */
export const DOCS_NAV: DocGroup[] = [
  {
    title: "Getting started",
    links: [
      { href: "/docs", title: "Introduction" },
      { href: "/docs/product", title: "Product overview" },
      { href: "/docs/use-cases", title: "Use cases" },
      { href: "/docs/quickstart", title: "Quickstart" },
      { href: "/docs/configuration", title: "Configuration" },
      { href: "/docs/deployment", title: "Deployment" },
    ],
  },
  {
    title: "Concepts",
    links: [
      { href: "/docs/how-it-works", title: "How it works" },
      { href: "/docs/scenarios", title: "Scenarios" },
      { href: "/docs/authority", title: "Authority & Guard" },
      { href: "/docs/replay", title: "Replay & Passport" },
    ],
  },
  {
    title: "Security",
    links: [
      { href: "/docs/security", title: "Security model" },
      { href: "/docs/architecture", title: "Architecture" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: "/docs/api", title: "API" },
      { href: "/docs/events", title: "Trace events" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/docs/faq", title: "FAQ" },
      { href: "/docs/about", title: "About" },
    ],
  },
];

export const DOCS_FLAT: (DocLink & { group: string })[] = DOCS_NAV.flatMap((g) => g.links.map((l) => ({ ...l, group: g.title })));
