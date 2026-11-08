import type { FastifyInstance } from "fastify";

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/projects", async (req) => {
    const { cursor, limit = 50 } = req.query as { cursor?: string; limit?: number };
    return { items: [], nextCursor: cursor ?? null, limit };
  });
}
