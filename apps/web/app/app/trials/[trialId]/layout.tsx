import { TrialFrame } from "@/components/trial/TrialFrame";

export default function TrialLayout({ children }: { children: React.ReactNode }) {
  return <TrialFrame>{children}</TrialFrame>;
}
