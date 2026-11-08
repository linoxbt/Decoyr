"use client";
import { ErrorState } from "@/components/ui/States";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState error={error} onRetry={reset} title={`Something broke in the UI${error.digest ? ` (ref ${error.digest})` : ""}`} />
    </div>
  );
}
