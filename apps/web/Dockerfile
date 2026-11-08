# syntax=docker/dockerfile:1
# Decoyr web console (Next.js standalone output). Built by infra/docker/docker-compose.yml (context: apps/web).
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# /api/v1/* is rewritten to this origin at build time. On the VM Caddy routes /api/* to the api
# service directly, so this only matters if the web container is reached without Caddy.
ARG DECOYR_API_URL=http://api:8000
ENV DECOYR_API_URL=${DECOYR_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 10003 decoyr && useradd --uid 10003 --gid 10003 --no-create-home --shell /usr/sbin/nologin decoyr
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
USER 10003:10003
EXPOSE 3000
CMD ["node", "server.js"]
