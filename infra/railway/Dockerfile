# syntax=docker/dockerfile:1
# Decoyr all-in-one image for a single PaaS service (Railway): control plane + mcp-city + egress-proxy
# + candidate-agent in one container, using the PROCESS sandbox (dev/demo mode — not a security
# boundary; the Passport says so). For real isolation use infra/docker on a VM (DECOYR_SANDBOX=docker).
# Build from the repository root:  docker build -f infra/railway/Dockerfile .

FROM node:22-bookworm-slim AS node-build
WORKDIR /build
COPY services/mcp-city/package.json services/mcp-city/package-lock.json mcp-city/
COPY services/egress-proxy/package.json services/egress-proxy/package-lock.json egress-proxy/
COPY services/candidate-agent/package.json services/candidate-agent/package-lock.json candidate-agent/
RUN for s in mcp-city egress-proxy candidate-agent; do (cd $s && npm ci --no-audit --no-fund); done
COPY services/mcp-city/tsconfig.json mcp-city/
COPY services/mcp-city/src mcp-city/src
COPY services/egress-proxy/tsconfig.json egress-proxy/
COPY services/egress-proxy/src egress-proxy/src
COPY services/candidate-agent/tsconfig.json candidate-agent/
COPY services/candidate-agent/src candidate-agent/src
RUN for s in mcp-city egress-proxy candidate-agent; do (cd $s && npm run build && npm prune --omit=dev); done

FROM python:3.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    DECOYR_REPO_ROOT=/srv/decoyr \
    DECOYR_SANDBOX=process \
    DECOYR_CANDIDATE_ENTRY=/srv/decoyr/services/candidate-agent/dist/index.js \
    DECOYR_SANDBOX_MCP_URL=http://127.0.0.1:7100 \
    DECOYR_MCP_HEALTH_URL=http://127.0.0.1:7100/healthz \
    DECOYR_EGRESS_HEALTH_URL=http://127.0.0.1:7200/healthz
COPY --from=node-build /usr/local/bin/node /usr/local/bin/node
WORKDIR /srv/decoyr
COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install -r apps/api/requirements.txt
COPY --from=node-build /build/mcp-city/package.json services/mcp-city/package.json
COPY --from=node-build /build/mcp-city/dist services/mcp-city/dist
COPY --from=node-build /build/mcp-city/node_modules services/mcp-city/node_modules
COPY --from=node-build /build/egress-proxy/package.json services/egress-proxy/package.json
COPY --from=node-build /build/egress-proxy/dist services/egress-proxy/dist
COPY --from=node-build /build/egress-proxy/node_modules services/egress-proxy/node_modules
COPY --from=node-build /build/candidate-agent/package.json services/candidate-agent/package.json
COPY --from=node-build /build/candidate-agent/dist services/candidate-agent/dist
COPY --from=node-build /build/candidate-agent/node_modules services/candidate-agent/node_modules
COPY packages/scenarios packages/scenarios
COPY apps/api/decoyr apps/api/decoyr
COPY infra/railway/start.sh /usr/local/bin/decoyr-start
RUN chmod 755 /usr/local/bin/decoyr-start \
    && groupadd --system --gid 10002 decoyr && useradd --system --uid 10002 --gid 10002 --no-create-home --shell /usr/sbin/nologin decoyr
USER 10002:10002
EXPOSE 8000
CMD ["decoyr-start"]
