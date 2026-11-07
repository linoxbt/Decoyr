import type { TraceEvent } from "@/lib/schemas";

export type AlignedRow = { baseline: TraceEvent | null; replay: TraceEvent | null; identical: boolean };

const key = (e: TraceEvent) => `${e.type.split(".")[0]}|${e.capability ?? e.type}|${e.target ?? ""}`;

/** LCS alignment of two significant-event timelines by (family, capability, target). */
export function alignTimelines(a: TraceEvent[], b: TraceEvent[]): AlignedRow[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = key(a[i]) === key(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: AlignedRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) {
      rows.push({ baseline: a[i], replay: b[j], identical: (a[i].decision ?? "") === (b[j].decision ?? "") && a[i].type === b[j].type });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) rows.push({ baseline: a[i++], replay: null, identical: false });
    else rows.push({ baseline: null, replay: b[j++], identical: false });
  }
  while (i < n) rows.push({ baseline: a[i++], replay: null, identical: false });
  while (j < m) rows.push({ baseline: null, replay: b[j++], identical: false });
  return rows;
}

const SIGNIFICANT = /^(tool\.(allow|deny|error)|net\.(allow|deny)|honeytoken\.|artifact\.created|injection\.delivered|process\.kill)/;
export const isSignificant = (e: TraceEvent) => SIGNIFICANT.test(e.type);
