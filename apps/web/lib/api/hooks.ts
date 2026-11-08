"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import type {
  AgentProfile,
  Artifact,
  AuthorityReport,
  CreateTrialRequest,
  Finding,
  Guard,
  Passport,
  ReplayComparison,
  RunSummary,
  ScenarioCatalog,
  SystemInfo,
  TraceEvent,
  Trial,
  TrialListItem,
  WorldView,
} from "../schemas";

export const qk = {
  system: ["system"] as const,
  scenarios: ["scenarios"] as const,
  agents: ["agents"] as const,
  agent: (id: string) => ["agent", id] as const,
  trials: (params?: Record<string, string>) => ["trials", params ?? {}] as const,
  trial: (id: string) => ["trial", id] as const,
  world: (id: string, inspect: boolean) => ["trial", id, "world", inspect] as const,
  events: (id: string, runId?: string | null) => ["trial", id, "events", runId ?? "all"] as const,
  artifacts: (id: string, runId?: string | null) => ["trial", id, "artifacts", runId ?? "all"] as const,
  findings: (id: string) => ["trial", id, "findings"] as const,
  authority: (id: string) => ["trial", id, "authority"] as const,
  guard: (id: string) => ["trial", id, "guard"] as const,
  replay: (id: string) => ["trial", id, "replay"] as const,
  passport: (id: string) => ["trial", id, "passport"] as const,
};

export const ACTIVE_STATUSES = new Set(["preparing", "running", "calibrating", "replaying"]);

function isActive(t?: Trial | null) {
  return !!t && (ACTIVE_STATUSES.has(t.status) || !!t.activeRunId);
}

export function useSystem() {
  return useQuery({ queryKey: qk.system, queryFn: () => api<SystemInfo>("/system"), staleTime: 30_000, retry: 1 });
}

export function useScenarios() {
  return useQuery({ queryKey: qk.scenarios, queryFn: () => api<ScenarioCatalog>("/scenarios"), staleTime: 60_000 });
}

export function useAgents() {
  return useQuery({ queryKey: qk.agents, queryFn: () => api<AgentProfile[]>("/agents") });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: qk.agent(id),
    queryFn: () => api<{ agent: AgentProfile; trials: TrialListItem[]; latestPassport: Passport | null }>(`/agents/${id}`),
  });
}

export function useTrials(params: { q?: string; status?: string; sort?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.sort) sp.set("sort", params.sort);
  const qs = sp.toString();
  return useQuery({
    queryKey: qk.trials(Object.fromEntries(sp)),
    queryFn: () => api<TrialListItem[]>(`/trials${qs ? `?${qs}` : ""}`),
    refetchInterval: (q) => (q.state.data?.some((t) => ACTIVE_STATUSES.has(t.status)) ? 3000 : false),
  });
}

export function useTrial(id: string) {
  return useQuery({
    queryKey: qk.trial(id),
    queryFn: () => api<Trial>(`/trials/${id}`),
    refetchInterval: (q) => (isActive(q.state.data) ? 2000 : false),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useWorld(id: string, inspect: boolean) {
  return useQuery({ queryKey: qk.world(id, inspect), queryFn: () => api<WorldView>(`/trials/${id}/world?inspect=${inspect}`) });
}

export function useEvents(id: string, runId?: string | null, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.events(id, runId),
    queryFn: () => api<TraceEvent[]>(`/trials/${id}/events${runId ? `?runId=${runId}` : ""}`),
    enabled: opts?.enabled ?? true,
  });
}

export function useArtifacts(id: string, runId?: string | null) {
  return useQuery({
    queryKey: qk.artifacts(id, runId),
    queryFn: () => api<Artifact[]>(`/trials/${id}/artifacts${runId ? `?runId=${runId}` : ""}`),
  });
}

export function useFindings(id: string) {
  return useQuery({ queryKey: qk.findings(id), queryFn: () => api<Finding[]>(`/trials/${id}/findings`) });
}

export function useAuthority(id: string) {
  return useQuery({ queryKey: qk.authority(id), queryFn: () => api<AuthorityReport>(`/trials/${id}/authority`) });
}

export function useGuard(id: string) {
  return useQuery({
    queryKey: qk.guard(id),
    queryFn: () => api<Guard>(`/trials/${id}/guard`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useReplay(id: string, active?: boolean) {
  return useQuery({
    queryKey: qk.replay(id),
    queryFn: () => api<ReplayComparison>(`/trials/${id}/replay`),
    // Keep polling while the cached comparison still says "running": the trial poll can observe the
    // finished status before the SSE `end` event, which would otherwise leave a stale comparison on screen.
    refetchInterval: (q) => (active || q.state.data?.status === "running" ? 2500 : false),
  });
}

export function usePassport(id: string) {
  return useQuery({ queryKey: qk.passport(id), queryFn: () => api<Passport>(`/trials/${id}/passport`) });
}

function useInvalidateTrial(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["trial", id] });
    qc.invalidateQueries({ queryKey: ["trials"] });
  };
}

export function useCreateTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTrialRequest) => api<Trial>("/trials", { method: "POST", json: body }),
    onSuccess: (t) => {
      qc.setQueryData(qk.trial(t.id), t);
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
  });
}

export function usePreparedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Trial>("/trials/prepared-demo", { method: "POST" }),
    onSuccess: (t) => {
      qc.setQueryData(qk.trial(t.id), t);
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
  });
}

export function useDuplicateTrial(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Trial>(`/trials/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trials"] }),
  });
}

export function useStartRun(id: string) {
  const inv = useInvalidateTrial(id);
  return useMutation({ mutationFn: () => api<RunSummary>(`/trials/${id}/run`, { method: "POST" }), onSuccess: inv });
}

export function useStopRun(id: string) {
  const inv = useInvalidateTrial(id);
  return useMutation({ mutationFn: () => api<RunSummary>(`/trials/${id}/stop`, { method: "POST" }), onSuccess: inv });
}

export function useCalibrate(id: string) {
  const qc = useQueryClient();
  const inv = useInvalidateTrial(id);
  return useMutation({
    mutationFn: () => api<AuthorityReport>(`/trials/${id}/calibrate`, { method: "POST" }),
    onSuccess: (r) => {
      qc.setQueryData(qk.authority(id), r);
      inv();
    },
  });
}

export function useReplayRun(id: string) {
  const inv = useInvalidateTrial(id);
  return useMutation({ mutationFn: () => api<RunSummary>(`/trials/${id}/replay`, { method: "POST" }), onSuccess: inv });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adminToken?: string) =>
      api<{ ok: boolean; demoTrialId: string | null }>("/demo/reset", {
        method: "POST",
        headers: adminToken ? { "X-Decoyr-Admin": adminToken } : undefined,
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
