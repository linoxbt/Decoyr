import Fastify from "fastify";
import { projectsRoutes } from "./projects";

export const app = Fastify({ logger: true });
app.register(projectsRoutes, { prefix: "/v2" });

app.setErrorHandler((err, _req, reply) => {
  if (err.statusCode === 429) {
    reply.header("Retry-After", "30");
  }
  reply.status(err.statusCode ?? 500).send({ error: err.message });
});
