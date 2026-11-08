# Decoyr sandbox services

| service | port | role |
|---|---|---|
| `mcp-city` | 7100 | Acme Labs synthetic enterprise as MCP tools (TS SDK v2, Streamable HTTP `/mcp`), Guard middleware before every handler, OpenAI-compatible inference relay `/v1/chat/completions` → control plane. The only thing a candidate can reach. |
| `egress-proxy` | 7200 | Controlled egress: policy-checked, synthetic hosts only (`docs.acme.local`, `api.acme.local`, sink `exfil.attacker.local`); never real network I/O. Reachable only from mcp-city. |
| `candidate-agent` | — | Demo candidate harness (ResearchBot): MCP client + tool-calling loop over the relay. Runs per trial in a hardened container (`decoyr/candidate-agent:latest`). `DECOYR_DRILL=runaway` = containment drill. |

Contracts: [`docs/contracts.md`](../docs/contracts.md).

## Local (process mode)

```bash
for s in egress-proxy mcp-city candidate-agent; do (cd services/$s && npm ci && npm run build); done
(cd services/egress-proxy && npm run dev) &   # :7200
(cd services/mcp-city && npm run dev) &       # :7100
# the api (DECOYR_SANDBOX=process) spawns: node services/candidate-agent/dist/index.js
```

## Tests

`npm test` in each service (node:test). `mcp-city`'s e2e test starts a mock control plane plus the
real egress-proxy, mcp-city and candidate-agent processes, so build all three first.
Containment: `bash tests/containment/run.sh` (needs Docker + the candidate image).

## Images

```bash
cd infra/docker && docker compose --profile build build   # decoyr/{mcp-city,egress-proxy,candidate-agent}:latest
```
