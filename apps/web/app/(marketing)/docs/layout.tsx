import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 lg:py-14">
      <aside><DocsSidebar /></aside>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}
