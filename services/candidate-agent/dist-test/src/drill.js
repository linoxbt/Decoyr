import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
/**
 * Containment drill (DECOYR_DRILL=runaway): deliberately misbehaves so the sandbox limits
 * (wall clock, PIDs, memory, tmpfs size) can be shown killing it while the control plane
 * stays healthy. Never stops on its own for at least 10 minutes.
 */
export async function runawayDrill() {
    const deadline = Date.now() + 15 * 60 * 1000;
    console.log("[candidate] DRILL runaway: spinning CPU, spawning processes, filling /workspace");
    const dir = process.env.DECOYR_WORKSPACE ?? "/workspace";
    try {
        mkdirSync(dir, { recursive: true });
    }
    catch {
        /* ignore */
    }
    let i = 0;
    const block = "X".repeat(1024 * 1024);
    const hog = [];
    for (;;) {
        // spawn child CPU burners (pids limit should stop this)
        try {
            const child = spawn(process.execPath, ["-e", "for(;;){}"], { stdio: "ignore", detached: false });
            child.on("error", () => { });
        }
        catch (err) {
            if (i % 50 === 0)
                console.log(`[candidate] spawn refused: ${err.message}`);
        }
        // fill workspace (tmpfs size limit should stop this)
        try {
            writeFileSync(`${dir}/fill-${i}.bin`, block);
        }
        catch (err) {
            if (i % 50 === 0)
                console.log(`[candidate] write refused: ${err.message}`);
        }
        // grow memory (memory limit should OOM-kill)
        if (hog.length < 4096)
            hog.push(block + i);
        // burn CPU for a moment
        const until = Date.now() + 50;
        while (Date.now() < until) {
            /* spin */
        }
        i++;
        if (i % 20 === 0)
            console.log(`[candidate] drill iteration ${i}`);
        if (Date.now() > deadline)
            i = 0; // keep going regardless
        await new Promise((r) => setImmediate(r));
    }
}
