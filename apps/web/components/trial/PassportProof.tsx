"use client";
import { useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { api } from "@/lib/api/client";
import { Panel, KV } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { shortHash } from "@/lib/formatting";
import type { Passport } from "@/lib/schemas";

type Verdict = { valid: boolean; reason: string; keyId?: string };

/** Agent fingerprint (what actually ran) and the Passport's Ed25519 signature, with live verification. */
export function PassportProof({ p }: { p: Passport }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const fp = p.fingerprint;

  const verify = async () => {
    setBusy(true);
    try {
      setVerdict(await api<Verdict>("/passports/verify", { method: "POST", json: p }));
    } catch (e) {
      setVerdict({ valid: false, reason: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {fp && (
        <Panel title="Agent fingerprint" subtitle="What actually ran. Name, version and purpose above are declared by the developer." className="md:col-span-2">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            <KV k="Runtime" mono>{fp.runtime ?? "—"}</KV>
            <KV k="Runtime digest" mono>{fp.runtimeDigest ? shortHash(fp.runtimeDigest, 26) : "—"}</KV>
            <KV k="Sandbox">{fp.sandbox ?? "—"}</KV>
            <KV k="System prompt sha256" mono>{fp.systemPromptSha256 ? shortHash(fp.systemPromptSha256, 20) : "—"}</KV>
            <KV k="Model requested" mono>{fp.modelRequested}</KV>
            <KV k="Models served (provider-reported)" mono>{fp.modelsServed.join(", ") || "—"}</KV>
            <KV k="Model calls (baseline / replay)">{fp.modelCalls.baseline} / {fp.modelCalls.replay}</KV>
            <KV k="Tool calls (baseline / replay)">{fp.toolCalls.baseline} / {fp.toolCalls.replay}</KV>
            <KV k="Model in the loop">
              {fp.modelInTheLoop ? <Badge tone="success">yes</Badge> : <Badge tone="danger">no: not attributed to an AI agent</Badge>}
            </KV>
            <KV k="Inference">{fp.inference === "vultr" ? "Vultr Serverless Inference" : <Badge tone="warning">simulated</Badge>}</KV>
          </dl>
          <p className="mt-2 text-[12px] text-muted">To check production matches this test, compare the runtime digest, the system prompt hash and the model.</p>
        </Panel>
      )}
      {p.signature && (
        <Panel title="Signature" subtitle="Ed25519, over the whole Passport. Any edit invalidates it.">
          <dl>
            <KV k="Algorithm">{p.signature.alg}</KV>
            <KV k="Key id" mono>{p.signature.keyId}</KV>
            <KV k="Payload sha256" mono>{shortHash(p.signature.payloadSha256, 20)}</KV>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={verify} loading={busy}>Verify signature</Button>
            <a href="/api/v1/passports/public-key" target="_blank" rel="noreferrer" className="text-[12px] text-info hover:underline">Public key</a>
          </div>
          {verdict && (
            <p role="status" className={verdict.valid ? "mt-2 flex items-start gap-1.5 text-[12.5px] text-success" : "mt-2 flex items-start gap-1.5 text-[12.5px] text-danger"}>
              {verdict.valid ? <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {verdict.reason}
            </p>
          )}
        </Panel>
      )}
    </>
  );
}
