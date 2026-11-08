"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 2_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
