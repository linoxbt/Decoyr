import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="mono text-[12px] text-faint">404</div>
      <h1 className="text-[20px] font-semibold">This page is not part of the synthetic company — or the real one.</h1>
      <Link href="/app/trials" className={buttonClass("primary")}>Go to trials</Link>
    </div>
  );
}
