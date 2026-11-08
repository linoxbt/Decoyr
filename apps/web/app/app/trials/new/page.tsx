"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { useCreateTrial, useModels, useScenarios } from "@/lib/api/hooks";
import type { CapabilityGroup } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

const schema = z.object({
  profileId: z.string().optional(),
  name: z.string().trim().min(1, "Agent name is required").max(60),
  version: z.string().trim().min(1, "Version is required").max(30),
  purpose: z.string().trim().min(8, "Describe the purpose in one line (8+ characters)").max(200),
  model: z.string().max(120).optional(),
  systemPrompt: z.string().max(8000, "Keep instructions under 8,000 characters").optional(),
  runtime: z.string().optional(),
  requestedCapabilities: z.array(z.string()).min(1, "Request at least one capability"),
  worldVersion: z.string().min(1),
  taskId: z.string().min(1),
  scenarioPack: z.array(z.string()).min(1, "Select at least one scenario pack"),
});
type FormValues = z.infer<typeof schema>;

const GROUPS: CapabilityGroup[] = ["Repository", "Documents", "Messages", "Secrets", "Network", "Artifact Write"];
const STEPS = ["Candidate", "Requested authority", "Trial"];

export default function NewTrialPage() {
  const router = useRouter();
  const { data: catalog, error, isLoading, refetch } = useScenarios();
  const { data: modelCatalog } = useModels();
  const create = useCreateTrial();
  const [step, setStep] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", version: "", purpose: "", model: "", systemPrompt: "", runtime: "", requestedCapabilities: [], worldVersion: "", taskId: "", scenarioPack: [] },
    mode: "onTouched",
  });
  const { register, setValue, watch, trigger, handleSubmit, formState } = form;
  const values = watch();

  // Prefill from builtin demo profile + catalog defaults
  useEffect(() => {
    if (!catalog) return;
    const demo = catalog.builtinAgents[0];
    if (demo && !form.getValues("name")) {
      form.reset({
        profileId: demo.id,
        name: demo.name,
        version: demo.version,
        purpose: demo.purpose,
        model: "",
        systemPrompt: demo.systemPrompt ?? "",
        runtime: demo.runtime ?? "",
        requestedCapabilities: demo.requestedCapabilities,
        worldVersion: catalog.worlds[0]?.version ?? "acme-labs-v1",
        taskId: catalog.tasks[0]?.id ?? "",
        scenarioPack: catalog.packs.filter((p) => p.defaultSelected).map((p) => p.id),
      });
    }
  }, [catalog, form]);

  const caps = useMemo(() => catalog?.capabilities ?? [], [catalog]);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load scenario catalog" /></div>;
  if (isLoading || !catalog) return <div className="p-6"><PageSkeleton /></div>;

  const toggle = (field: "requestedCapabilities" | "scenarioPack", v: string) => {
    const cur = form.getValues(field);
    setValue(field, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v], { shouldValidate: true, shouldDirty: true });
  };

  const next = async () => {
    const fields: (keyof FormValues)[][] = [["name", "version", "purpose"], ["requestedCapabilities"], ["worldVersion", "taskId", "scenarioPack"]];
    if (await trigger(fields[step])) setStep((s) => Math.min(2, s + 1));
  };

  const onSubmit = (v: FormValues) => {
    const builtin = catalog.builtinAgents.find((a) => a.id === v.profileId);
    const prompt = (v.systemPrompt ?? "").trim();
    const unchangedBuiltin =
      builtin && builtin.name === v.name && builtin.version === v.version && !v.model &&
      prompt === (builtin.systemPrompt ?? "").trim() && (!v.runtime || v.runtime === builtin.runtime);
    create.mutate(
      {
        agent: {
          profileId: unchangedBuiltin ? builtin.id : undefined, name: v.name, version: v.version, purpose: v.purpose,
          model: v.model || undefined, systemPrompt: prompt || undefined, runtime: v.runtime || undefined,
          requestedCapabilities: v.requestedCapabilities,
        },
        worldVersion: v.worldVersion,
        taskId: v.taskId,
        scenarioPack: v.scenarioPack,
      },
      { onSuccess: (t) => router.push(`/app/trials/${t.id}/world`) },
    );
  };

  const task = catalog.tasks.find((t) => t.id === values.taskId);
  const world = catalog.worlds.find((w) => w.version === values.worldVersion);
  const L = catalog.limits;

  return (
    <div>
      <PageHeader title="New trial" breadcrumb={<Link href="/app/trials" className="hover:text-text">Trials</Link>} description="Configure the candidate, its requested authority hypothesis and the trial. Nothing executes until you start it." />
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-4 p-4 md:p-6" noValidate>
        <ol className="flex items-center gap-2 text-[13px]" aria-label="Wizard steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={cn("flex size-6 items-center justify-center rounded-full border text-[12px] font-semibold", i < step ? "border-text bg-text text-white" : i === step ? "border-text" : "border-border-strong text-faint")} aria-current={i === step ? "step" : undefined}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(i === step ? "font-medium" : "text-muted")}>{s}</span>
              {i < 2 && <span className="mx-1 h-px w-8 bg-border-strong" aria-hidden />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Panel title="Candidate" subtitle="Who is being tested.">
            <div className="space-y-4">
              <div>
                <SectionLabel className="mb-1.5">Built-in profile</SectionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalog.builtinAgents.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => form.reset({ ...form.getValues(), profileId: a.id, name: a.name, version: a.version, purpose: a.purpose, model: "", systemPrompt: a.systemPrompt ?? "", runtime: a.runtime ?? "", requestedCapabilities: a.requestedCapabilities })}
                      className={cn("rounded-[6px] border px-3 py-2 text-left", values.profileId === a.id ? "border-text bg-surface-2" : "border-border hover:bg-surface-2")}
                    >
                      <div className="text-[13px] font-medium">{a.name} <span className="mono text-muted">{a.version}</span></div>
                      <div className="text-[12px] text-muted">{a.purpose}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Agent name" error={formState.errors.name?.message}>
                  <input {...register("name")} className={inputCls} />
                </Field>
                <Field label="Version" error={formState.errors.version?.message}>
                  <input {...register("version")} className={cn(inputCls, "mono")} />
                </Field>
              </div>
              <Field label="Declared purpose" error={formState.errors.purpose?.message}>
                <input {...register("purpose")} className={inputCls} />
              </Field>
              <div className="space-y-3 rounded-[6px] border border-border p-3">
                <SectionLabel>Agent configuration</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Model"
                    hint={modelCatalog?.mode === "simulated" ? "No Vultr key configured: the deterministic simulated model runs." : "Chat models with tool calling on Vultr Serverless Inference."}
                  >
                    <select {...register("model")} className={cn(inputCls, "mono")}>
                      <option value="">Default ({modelCatalog?.default ?? "control plane default"})</option>
                      {(modelCatalog?.models ?? []).filter((m) => m.id !== modelCatalog?.default).map((m) => (
                        <option key={m.id} value={m.id} title={m.description}>{m.id}</option>
                      ))}
                    </select>
                  </Field>
                  {(catalog.runtimes?.length ?? 0) > 1 ? (
                    <Field label="Runtime" hint="Agent runtime image. Operators add their own with DECOYR_CANDIDATE_IMAGES.">
                      <select {...register("runtime")} className={cn(inputCls, "mono")}>
                        {catalog.runtimes!.map((r) => <option key={r.id} value={r.default ? "" : r.id}>{r.id}{r.default ? " (built-in)" : ""}</option>)}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Runtime" hint="Bring your own agent: see Docs › Test your own agent.">
                      <input value={catalog.runtimes?.[0]?.id ?? "built-in runtime"} readOnly className={cn(inputCls, "mono text-muted")} />
                    </Field>
                  )}
                </div>
                <Field label="Agent instructions (system prompt)" error={formState.errors.systemPrompt?.message} hint="Paste your agent's real instructions to test how it behaves. Sent only to the model, never shown to the world.">
                  <textarea {...register("systemPrompt")} rows={6} className="w-full rounded-[6px] border border-border-strong bg-surface px-2.5 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-text" />
                </Field>
              </div>
            </div>
          </Panel>
        )}

        {step === 1 && (
          <Panel title="Requested authority" subtitle="What the agent says it needs.">
            <div className="mb-4 flex gap-2 rounded-[6px] border border-info/30 bg-info-bg px-3 py-2 text-[12.5px] text-info">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>This is only the agent&apos;s <strong>requested hypothesis</strong>. Decoyr does not trust it — it observes what the agent actually uses under pressure and derives the minimum authority from evidence.</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {GROUPS.map((g) => {
                const items = caps.filter((c) => c.group === g);
                if (!items.length) return null;
                return (
                  <fieldset key={g} className="rounded-[6px] border border-border p-3">
                    <legend className="px-1 text-[12px] font-semibold">{g}</legend>
                    <div className="space-y-1.5">
                      {items.map((c) => (
                        <label key={c.name} className="flex cursor-pointer items-start gap-2 text-[13px]">
                          <input type="checkbox" className="mt-1 accent-black" checked={values.requestedCapabilities.includes(c.name)} onChange={() => toggle("requestedCapabilities", c.name)} />
                          <span>
                            <span className="mono text-[12.5px]">{c.name}</span>
                            <span className="block text-[12px] text-muted">{c.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            {formState.errors.requestedCapabilities && <p className="mt-2 text-[12px] text-danger">{formState.errors.requestedCapabilities.message}</p>}
            <p className="mt-3 text-[12px] text-muted">{values.requestedCapabilities.length} capabilities requested.</p>
          </Panel>
        )}

        {step === 2 && (
          <Panel title="Trial" subtitle="The synthetic world, legitimate task and attack pack.">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="World">
                  <select {...register("worldVersion")} className={inputCls}>
                    {catalog.worlds.map((w) => <option key={w.version} value={w.version}>{w.name}</option>)}
                  </select>
                </Field>
                <Field label="Legitimate task">
                  <select {...register("taskId")} className={inputCls}>
                    {catalog.tasks.filter((t) => t.worldVersion === values.worldVersion).map((t) => <option key={t.id} value={t.id}>{t.goal}</option>)}
                  </select>
                </Field>
              </div>
              {world && <p className="text-[12.5px] text-muted">{world.description}</p>}
              <div>
                <SectionLabel className="mb-1.5">Scenario packs</SectionLabel>
                <div className="space-y-2">
                  {catalog.packs.map((p) => (
                    <label key={p.id} className={cn("flex cursor-pointer items-start gap-2 rounded-[6px] border px-3 py-2", values.scenarioPack.includes(p.id) ? "border-text" : "border-border")}>
                      <input type="checkbox" className="mt-1 accent-black" checked={values.scenarioPack.includes(p.id)} onChange={() => toggle("scenarioPack", p.id)} />
                      <span>
                        <span className="text-[13px] font-medium">{p.name}</span> {p.optional && <Badge>optional</Badge>}
                        <span className="block text-[12px] text-muted">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {formState.errors.scenarioPack && <p className="mt-1 text-[12px] text-danger">{formState.errors.scenarioPack.message}</p>}
              </div>
              <div className="rounded-[6px] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px]">
                <SectionLabel className="mb-1">Summary</SectionLabel>
                <p>
                  <strong>{values.name} {values.version}</strong> on <span className="mono">{values.model || modelCatalog?.default || "default model"}</span> will be asked to <em>{task?.goal ?? "—"}</em> inside <strong>{world?.name ?? values.worldVersion}</strong>, with {values.requestedCapabilities.length} requested capabilities and {values.scenarioPack.length} scenario pack(s).
                </p>
                <p className="mt-1 text-muted">
                  Limits per run: {L.wallSeconds}s wall clock · {L.memoryMb} MB · {L.cpu} CPU · {L.pids} PIDs · {L.maxToolCalls} tool calls. A baseline run typically takes 20–90s; the guarded replay takes about the same.
                </p>
              </div>
            </div>
          </Panel>
        )}

        {create.error && <ErrorState error={create.error} title="Could not create trial" onRetry={() => handleSubmit(onSubmit)()} />}

        <div className="flex items-center justify-between">
          {step > 0 ? (
            <Button type="button" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="size-4" aria-hidden /> Back
            </Button>
          ) : (
            <Link href="/app/trials" className={buttonClass("ghost")}>Cancel</Link>
          )}
          {step < 2 ? (
            <Button type="button" variant="primary" onClick={next}>
              Continue <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={create.isPending}>Create Trial</Button>
          )}
        </div>
      </form>
    </div>
  );
}

const inputCls = "h-9 w-full rounded-[6px] border border-border-strong bg-surface px-2.5 text-[13px] outline-none focus:border-text";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>}
      {error && <span className="mt-0.5 block text-[11.5px] text-danger">{error}</span>}
    </label>
  );
}
