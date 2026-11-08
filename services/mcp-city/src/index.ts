import { config } from "./config.js";
import { createApp } from "./server.js";

const server = createApp();
server.listen(config.port, config.host, () => {
  console.log(`[mcp-city] listening on ${config.host}:${config.port} (control plane ${config.controlPlaneUrl}, egress ${config.egressUrl})`);
});
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
