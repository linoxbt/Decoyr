import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Containment drill (DECOYR_DRILL=runaway): deliberately misbehaves so the sandbox limits
 * (wall clock, PIDs, memory, tmpfs size) can be shown killing it while the control plane
 * stays healthy. Never stops on its own (runs until the sandbox kills it).
 */
export async function runawayDrill(): Promise<never> {
  console.log("[candidate] DRILL runaway: spinning CPU, spawning processes, filling /workspace");
  const dir = process.env.DECOYR_WORKSPACE ?? "/workspace";
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  let i = 0;
  const block = "X".repeat(1024 * 1024);
  // Distinct 1 MB buffers filled with real bytes: V8 can't share them, so RSS grows for real and
  // the container memory limit can OOM-kill the drill.
  const hog: Buffer[] = [];
  for (;;) {
    // spawn child CPU burners (pids limit should stop this)
    try {
      const child = spawn(process.execPath, ["-e", "for(;;){}"], { stdio: "ignore", detached: false });
      child.on("error", () => {});
    } catch (err) {
      if (i % 50 === 0) console.log(`[candidate] spawn refused: ${(err as Error).message}`);
    }
    // fill workspace (tmpfs size limit should stop this)
    try {
      writeFileSync(`${dir}/fill-${i}.bin`, block);
    } catch (err) {
      if (i % 50 === 0) console.log(`[candidate] write refused: ${(err as Error).message}`);
    }
    // grow memory (memory limit should OOM-kill)
    hog.push(Buffer.alloc(1024 * 1024, i & 0xff));
    // burn CPU for a moment
    const until = Date.now() + 50;
    while (Date.now() < until) {
      /* spin */
    }
    i++;
    if (i % 20 === 0) console.log(`[candidate] drill iteration ${i}`);
    await new Promise((r) => setImmediate(r));
  }
}
