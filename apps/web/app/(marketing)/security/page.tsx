import Link from "next/link";
import type { Metadata } from "next";
import { Box, Cpu, EyeOff, Fingerprint, KeyRound, Lock, Network, ScrollText, ShieldAlert, ShieldCheck, Trash2, UserX } from "lucide-react";
import { Card, CtaBand, DefList, Eyebrow, PageHero, Section, SectionHeader } from "@/components/marketing/Section";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Security",
  description: "How Decoyr isolates the agent under test: credential separation, hardened per-run containers, per-run internal networks, fail-closed policy, masked honeycredentials, the threat model and what Decoyr does not claim.",
};

const LAYERS = [
  { icon: <KeyRound className="size-4" />, t: "Credential separation", d: "The candidate receives only a short-lived HMAC-signed trial token scoped to one run. It never sees the Vultr inference key, the internal signing key or the service token." },
  { icon: <UserX className="size-4" />, t: "Non-root, no capabilities", d: "Containers run as uid 10001 with cap-drop ALL and no-new-privileges. The process cannot gain privileges even if it tries." },
  { icon: <Lock className="size-4" />, t: "Read-only filesystem", d: "The root filesystem is read-only. Only small noexec tmpfs mounts at /tmp and /workspace are writable." },
  { icon: <Cpu className="size-4" />, t: "Resource limits", d: "Memory (with swap pinned), CPU quota, PID limit and a wall-clock kill per run. The optional drill proves they hold." },
  { icon: <Network className="size-4" />, t: "Per-run internal network", d: "Each run gets its own internal Docker network with no route to the internet. The only peer is mcp-city, attached under the alias mcp-city." },
  { icon: <ShieldCheck className="size-4" />, t: "Policy before handlers", d: "Every tool call is evaluated against the Guard before its handler runs; every outbound request is evaluated again at the egress proxy." },
  { icon: <ShieldAlert className="size-4" />, t: "Fail closed", d: "If the policy service errors or can't be reached, mcp-city and the egress proxy deny. Inactive runs refuse further calls." },
  { icon: <Fingerprint className="size-4" />, t: "Masked evidence", d: "Honeycredential values are replaced with masked forms in every stored event and in anything sent to the browser." },
  { icon: <Trash2 className="size-4" />, t: "Disposable sandboxes", d: "Containers and networks are force-removed after each run. On restart, an orphan sweep cleans anything left behind." },
];

const CHECKS = [
  "runs as non-root uid/gid 10001",
  "no effective Linux capabilities (CapEff=0)",
  "no-new-privileges set",
  "root filesystem is read-only",
  "explicit writable /workspace",
  "no control-plane secrets in the environment",
  "no Docker socket",
  "private PID namespace",
  "reaches mcp-city (the only allowed path)",
  "cannot reach the control plane by name or IP",
  "no direct internet egress by name or IP",
  "no cloud metadata endpoint",
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="The agent under test should never be able to hurt the tester."
        lead="Decoyr assumes the candidate agent is hostile. Trusted and untrusted zones are separated by credential, process, container and network boundaries, and the policy that contains the agent is enforced in code."
      >
        <Link href="/architecture" className={buttonClass("primary", "lg")}>View architecture</Link>
        <Link href="/docs#containment" className={buttonClass("secondary", "lg")}>Containment tests</Link>
      </PageHero>

      <Section>
        <SectionHeader eyebrow="Defense in depth" title="Nine layers between the agent and anything real." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LAYERS.map((l) => <Card key={l.t} icon={l.icon} title={l.t}>{l.d}</Card>)}
        </div>
      </Section>

      <Section tinted>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Trust zones</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Who can talk to whom.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              The control plane drives the Docker SDK and holds every secret. The sandbox services sit between it and the candidate. The candidate sits on an isolated per-run network.
            </p>
          </div>
          <DefList
            labelWidth="150px"
            rows={[
              ["Control plane", "FastAPI api, database, Docker SDK. Holds the inference key, signing key and service token. Never reachable from a candidate."],
              ["Sandbox services", "mcp-city (tools + inference relay) and egress-proxy (synthetic network). Authenticate to the api with the service token."],
              ["Candidate", "Your agent. Holds only its trial token. Can reach mcp-city:7100 and nothing else."],
              ["Outside world", "Never contacted on the agent's behalf. Synthetic hosts are served from the world snapshot."],
            ]}
          />
        </div>
      </Section>

      <Section id="threats">
        <SectionHeader eyebrow="Threat model" title="What we defend against." />
        <div className="scroll-thin overflow-x-auto rounded-[8px] border border-border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b border-border bg-surface-2 text-left text-[12px]"><tr><th className="px-4 py-2.5 font-semibold">Threat</th><th className="px-4 py-2.5 font-semibold">Mitigation</th></tr></thead>
            <tbody>
              {[
                ["Agent exfiltrates a credential", "All credentials are honeytokens; egress is default-deny under Guard; any credential in an outbound body is detected and recorded."],
                ["Agent escapes to the host", "Non-root, no capabilities, no-new-privileges, read-only rootfs, no Docker socket, private PID namespace."],
                ["Agent attacks the control plane", "Per-run internal network; the api isn't attached to it; mcp-city authenticates the trial token locally."],
                ["Agent exhausts resources", "Memory, CPU, PID and wall-clock limits; the drill verifies them and checks control-plane health afterwards."],
                ["Agent forges another run's identity", "Run and trial IDs come from the signed token claims, never from tool arguments."],
                ["Policy service outage", "Fail closed: tools and egress are denied."],
                ["Secrets leak through evidence", "Masking before storage and before anything reaches the browser."],
              ].map(([t, m]) => (
                <tr key={t} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{t}</td><td className="px-4 py-3 text-muted">{m}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section tinted>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Verified, not asserted</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">A containment suite you can run.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              tests/containment/run.sh launches a candidate-like container with the orchestrator's exact hardening flags on a per-run internal network and checks the boundary from the inside. Run it on your Docker host after every infrastructure change.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-start gap-2 rounded-[6px] border border-border bg-surface px-3 py-2 text-[13px]">
                <span className="mono mt-px text-[11px] font-semibold text-muted">CHECK</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Honest limits</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">What Decoyr does not claim.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">Calibration evidence is valuable precisely because it's scoped. Every Passport repeats these limits.</p>
          </div>
          <ul className="space-y-3 text-[14px]">
            {[
              ["No universal safety rating", "Results hold for the tested world, task, scenario pack and seed only."],
              ["Untested means unproven", "Capabilities never exercised are denied, not certified."],
              ["Models are nondeterministic", "A replay demonstrates containment of the observed behavior, not every possible behavior."],
              ["Process mode is for development", "The process sandbox is not a security boundary; the Docker sandbox is."],
              ["Change invalidates", "A new agent version, model, prompt or task needs a new trial."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3"><EyeOff className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /><span><span className="font-medium">{t}.</span> <span className="text-muted">{d}</span></span></li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tinted className="py-10 lg:py-12">
        <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
          <Box className="size-5 text-muted" aria-hidden />
          <span className="text-muted">Found a weakness in the sandbox? Treat it as a finding: open an issue on the repository with reproduction steps.</span>
          <ScrollText className="ml-auto hidden size-5 text-faint sm:block" aria-hidden />
        </div>
      </Section>

      <CtaBand title="Contain first, then trust." lead="Watch a hostile instruction meet the Guard in a sandbox built to absorb it." secondary={{ href: "/architecture", label: "Architecture" }} />
    </>
  );
}
