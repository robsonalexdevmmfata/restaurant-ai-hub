import type { FastifyInstance } from "fastify";
import { z } from "zod";

import * as diningTableService from "./service.js";

const tableParamsSchema = z.object({
  slug: z.string().min(1).max(160),
  tableNumber: z.coerce.number().int().min(1).max(100),
});

const closeBodySchema = z.object({ sessionId: z.string().uuid() });

export async function diningTableRoutes(app: FastifyInstance) {
  app.get("/public/tenants/:slug/tables", async (request, reply) => {
    const parsed = z.object({ slug: z.string().min(1).max(160) }).safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid restaurant slug" });
    const tables = await diningTableService.listPublicTables(parsed.data.slug);
    if (!tables) return reply.status(404).send({ error: "Restaurant not found" });
    return tables;
  });

  app.post("/public/tenants/:slug/tables/:tableNumber/open", async (request, reply) => {
    const parsed = tableParamsSchema.safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid table link" });
    const session = await diningTableService.openPublicTable(parsed.data.slug, parsed.data.tableNumber);
    if (!session) return reply.status(404).send({ error: "Restaurant not found" });
    return reply.status(200).send({ session });
  });

  app.post("/public/tenants/:slug/tables/:tableNumber/close", async (request, reply) => {
    const params = tableParamsSchema.safeParse(request.params);
    const body = closeBodySchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ error: "Invalid table close request" });
    const session = await diningTableService.closePublicTable(
      params.data.slug,
      params.data.tableNumber,
      body.data.sessionId,
    );
    if (!session) return reply.status(409).send({ error: "Table session is no longer active" });
    return { session };
  });
}
