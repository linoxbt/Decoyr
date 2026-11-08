import { config } from "./config.js";
import { createApp } from "./server.js";
const server = createApp();
server.listen(config.port, config.host, () => {
    console.log(`[egress-proxy] listening on ${config.host}:${config.port} (synthetic network only; control plane ${config.controlPlaneUrl})`);
});
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
