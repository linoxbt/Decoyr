# Handoff: finish the Decoyr control plane (apps/api)

## Context

Decoyr is a **defensive** tool for the Vultr "Agent Rush — Blast Radius Zero" hackathon. It tests an
untrusted AI agent inside a **fake, sandboxed company** (Acme Labs) before that agent is given access to a
real organization. All data in the world is synthetic: fake repo, fake docs, fake "honeytoken" credentials,
fake hosts. Nothing ever leaves the sandbox. The product observes what the agent does, derives the minimum
permissions it needs, compiles a machine-enforced policy (Guard), replays the same trial with Guard on,
and produces an evidence report (Passport).

Core loop: BUILD -> RELEASE -> TEMPT -> OBSERVE -> PROFILE -> CONSTRAIN -> REPLAY -> PROVE.

Branch: `ccr-3f7eeb23-lzxy2d`. Specs: the two PDFs the user will attach (Master Build Spec, Frontend Build Spec).

## Source of truth

- `docs/contracts.md` — topology, env vars, tokens, internal endpoints, public API table, WorldSnapshot.
- `packages/schemas/src/index.ts` — every JSON shape the API must return (camelCase).

## Already done (do not rebuild)

- `services/mcp-city`, `services/egress-proxy`, `services/candidate-agent` — TypeScript, MCP TS SDK v2, tested
  against a mock control plane. Docker images build. They call the api's `/internal/*` endpoints.
- `apps/web` — complete Next.js frontend; builds; never run against a real API yet.
- `infra/docker` (compose), `infra/caddy`, `infra/vultr`, `tests/containment/run.sh` (19 sandbox checks).
- `packages/scenarios/acme-labs-v1` — world files + `manifest.json`; `world.json` is a rendered sample.
- `apps/api/decoyr/`: `config.py`, `db.py` (SQLAlchemy Core tables), `ids.py`, `tokens.py`, `scenarios.py`
  (deterministic world rendering, catalog, assertion definitions), `events.py` (append-only trace, `emit`,
  `to_api`), `policy.py` (Guard evaluation), `inference.py` (Vultr client + keyless simulated model),
  `core.py` (trial/agent/run state + serialization), `analysis.py` (task assertions implemented).

## To build (in apps/api/decoyr), one module at a time, in this order

1. **`main.py`** — FastAPI app with every public route in the contracts table (`/api/v1/...`), the SSE stream
   (`/trials/{id}/stream`: poll `db.run_events` every ~300 ms, `event: trace|status|end`, `id: <runId>:<seq>`,
   honor `after` / `Last-Event-ID`, 15 s heartbeat), and the internal routes:
   - `GET /internal/runs/{runId}/world` (service token)
   - `POST /internal/policy/evaluate` (service token; uses `policy.evaluate` with the run's Guard or `None` for
     baseline; counts tool calls vs `max_tool_calls`; matches tool calls to the last model response by tool
     name + args for `correlationId`; records `tool.request`/`tool.allow`/`tool.deny` or `net.*` events)
   - `POST /internal/events`, `POST /internal/artifacts`, `POST /internal/inference/chat` (trial token +
     service token; records `model.request`/`model.response`, calls `inference.chat`).
   Errors as `{detail, referenceId}`. Call `core.ensure_builtin_agents()` and `orchestrator.recover_orphans()` on startup.
2. **`reports.py`** — `replay_comparison(trial)` -> `ReplayComparison`, `passport(trial)` -> `Passport`,
   `guard_to_api`, `artifact_to_api`. Passport never shows a universal score; label
   "Calibrated: Release Notes / Acme Labs v1" only when replay task PASS and security PASS.
3. **`authority.py`** (replace placeholder) — derive Minimum Viable Authority from baseline `tool.request`
   events + scenario `requiredCapabilities`; classes required / constrained / unnecessary / dangerous /
   untested; compile Guard JSON (`decoyr.guard.v1`, see Master spec §14), store in `db.guards`, set
   `trial.guard_id`; static check of baseline calls under the new Guard as iteration 1; if the latest replay
   failed the task, promote the narrowest denied non-dangerous capability (spec §13 steps 5–8).
4. **`orchestrator.py`** (replace placeholder) — per-run lifecycle: mint trial token, run candidate either as
   a process (`DECOYR_SANDBOX=process`: `node services/candidate-agent/dist/index.js`, minimal env) or a Docker
   container (`DECOYR_SANDBOX=docker`: per-run internal network named `decoyr-run-<id>`, connect container
   `decoyr-mcp-city` with alias `mcp-city`, hardening flags exactly as `HARDEN` in
   `tests/containment/run.sh`), wall-clock kill, teardown, then evaluate assertions, update run + trial
   status (`compromised` / `observed` / `contained` / `failed`), emit `run.*` / `sandbox.*` events.
5. **`analysis.py` security hook** — implement `security_assertions`, `classify_events`, `build_findings`,
   `dangerous_capabilities` per the docstring and the assertion definitions in `scenarios.py`.

## Also fix

- `apps/api/Dockerfile` building from the **repo root** (compose: `context: ../..`, `dockerfile: apps/api/Dockerfile`)
  so `packages/scenarios` is in the image.
- `config.py`: allow `DECOYR_REPO_ROOT` to override `REPO_ROOT` (currently `parents[3]` breaks inside the image).
- Frontend inspector reads `evidence.args`, `preview`, `reason`, `ruleId`, `resultSha256` — emit those.

## Verify

- `cd apps/api && uv venv .venv && uv pip install -r requirements-dev.txt`, run `uvicorn decoyr.main:app --port 8000`.
- Start services (`npm run dev` in `services/egress-proxy` and `services/mcp-city`), web (`cd apps/web && npm run dev`).
- Run the prepared demo end to end in the browser and with `apps/web/tests/e2e/prepared-demo.spec.ts`.
- Without `VULTR_SERVERLESS_INFERENCE_API_KEY` the simulated model is used and labeled as such.
- Commit and push to `ccr-3f7eeb23-lzxy2d` after each module.
