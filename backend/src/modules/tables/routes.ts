import type { FastifyInstance } from "fastify";

import { isUniqueViolation, parseId } from "../../lib/helpers.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";
import { closeSessionSchema, createTableSchema, updateTableSchema } from "./schemas.js";
import * as tableService from "./service.js";

/** Mesas, sessões de mesa e caixa. Todas protegidas por JWT do restaurante. */
export async function tableRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireJwt(request, reply);
    if (reply.sent) return;

    const { role } = getAuthUser(request);
    if (role === "owner" || role === "gerente") return;

    const route = (request.routeOptions.url ?? request.url.split("?")[0]).replace(/^\/api(?=\/)/, "");
    const cashierRead =
      role === "caixa" &&
      request.method === "GET" &&
      (route === "/me/tables" || route.startsWith("/me/cashier/sessions"));
    const cashierClose =
      role === "caixa" &&
      request.method === "POST" &&
      route.startsWith("/me/cashier/sessions/") &&
      route.endsWith("/close");
    const cashierOpenTable =
      role === "caixa" &&
      request.method === "POST" &&
      route.startsWith("/me/tables/") &&
      route.endsWith("/open");
    if (!cashierRead && !cashierClose && !cashierOpenTable) {
      return reply.status(403).send({ error: "Este perfil não tem acesso a esta operação" });
    }
  });

  app.get("/me/tables", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return tableService.listTables(restaurantId);
  });

  app.post("/me/tables", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = createTableSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    try {
      const table = await tableService.createTable(restaurantId, parsed.data);
      return reply.status(201).send(table);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "Já existe uma mesa com esse nome" });
      }
      throw error;
    }
  });

  app.patch("/me/tables/:tableId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const tableId = parseId((request.params as { tableId: string }).tableId);
    if (!tableId) return reply.status(400).send({ error: "Invalid table id" });

    const parsed = updateTableSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const table = await tableService.updateTable(tableId, restaurantId, parsed.data);
    if (!table) return reply.status(404).send({ error: "Table not found" });
    return table;
  });

  app.delete("/me/tables/:tableId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const tableId = parseId((request.params as { tableId: string }).tableId);
    if (!tableId) return reply.status(400).send({ error: "Invalid table id" });

    const deleted = await tableService.deleteTable(tableId, restaurantId);
    if (!deleted) return reply.status(404).send({ error: "Table not found" });
    return reply.status(204).send();
  });

  /** Abre (ou reaproveita) a sessão da mesa. */
  app.post("/me/tables/:tableId/open", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const tableId = parseId((request.params as { tableId: string }).tableId);
    if (!tableId) return reply.status(400).send({ error: "Invalid table id" });

    const table = await tableService.getTable(tableId, restaurantId);
    if (!table) return reply.status(404).send({ error: "Table not found" });

    const session = await tableService.ensureOpenSession(tableId, restaurantId);
    return reply.status(201).send(session);
  });

  /* ---------- Caixa ---------- */

  app.get("/me/cashier/sessions", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return tableService.listOpenSessions(restaurantId);
  });

  app.get("/me/cashier/sessions/:sessionId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const sessionId = parseId((request.params as { sessionId: string }).sessionId);
    if (!sessionId) return reply.status(400).send({ error: "Invalid session id" });

    const bill = await tableService.getSessionBill(sessionId, restaurantId);
    if (!bill) return reply.status(404).send({ error: "Session not found" });
    return bill;
  });

  app.post("/me/cashier/sessions/:sessionId/close", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const sessionId = parseId((request.params as { sessionId: string }).sessionId);
    if (!sessionId) return reply.status(400).send({ error: "Invalid session id" });

    const parsed = closeSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const session = await tableService.closeSession(sessionId, restaurantId, parsed.data);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    return session;
  });
}
