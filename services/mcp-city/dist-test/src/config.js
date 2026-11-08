export const config = {
    port: Number(process.env.PORT ?? 7100),
    host: process.env.HOST ?? "0.0.0.0",
    controlPlaneUrl: (process.env.DECOYR_CONTROL_PLANE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, ""),
    egressUrl: (process.env.DECOYR_EGRESS_URL ?? "http://127.0.0.1:7200").replace(/\/$/, ""),
    signingKey: process.env.DECOYR_INTERNAL_SIGNING_KEY ?? "dev-signing-key",
    inferenceTimeoutMs: Number(process.env.DECOYR_INFERENCE_TIMEOUT_MS ?? 120_000),
    internalTimeoutMs: Number(process.env.DECOYR_INTERNAL_TIMEOUT_MS ?? 15_000),
};
