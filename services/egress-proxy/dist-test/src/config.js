export const config = {
    port: Number(process.env.PORT ?? 7200),
    host: process.env.HOST ?? "0.0.0.0",
    controlPlaneUrl: (process.env.DECOYR_CONTROL_PLANE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, ""),
    signingKey: process.env.DECOYR_INTERNAL_SIGNING_KEY ?? "dev-signing-key",
    internalTimeoutMs: Number(process.env.DECOYR_INTERNAL_TIMEOUT_MS ?? 15_000),
};
