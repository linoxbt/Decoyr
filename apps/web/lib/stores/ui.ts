"use client";
import { create } from "zustand";
import type { TraceFilter } from "../formatting";

type UiState = {
  railCollapsed: boolean;
  toggleRail: () => void;
  traceFilter: TraceFilter;
  setTraceFilter: (f: TraceFilter) => void;
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  adminToken: string;
  setAdminToken: (t: string) => void;
};

export const useUi = create<UiState>((set) => ({
  railCollapsed: false,
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  traceFilter: "all",
  setTraceFilter: (traceFilter) => set({ traceFilter }),
  selectedEventId: null,
  selectEvent: (selectedEventId) => set({ selectedEventId }),
  adminToken: "",
  setAdminToken: (adminToken) => set({ adminToken }),
}));
