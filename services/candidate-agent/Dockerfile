# syntax=docker/dockerfile:1
# Optional build secret "npm_ca": extra CA bundle for TLS-intercepting build proxies (not needed on Vultr).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-slim
ENV NODE_ENV=production \
    DECOYR_WORKSPACE=/workspace
WORKDIR /app
RUN groupadd --gid 10001 decoyr && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin decoyr \
    && mkdir -p /workspace && chown 10001:10001 /workspace
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --chown=root:root package.json ./
USER 10001:10001

CMD ["node", "dist/index.js"]
