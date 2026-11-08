"use client";
import { Suspense } from "react";
import { LiveRun } from "@/components/trace/LiveRun";

export default function RunPage() {
  return (
    <Suspense>
      <LiveRun />
    </Suspense>
  );
}
