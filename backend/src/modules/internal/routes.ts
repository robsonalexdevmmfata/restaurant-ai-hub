import type { FastifyInstance } from "fastify";

import { requireApiSecret } from "../../middleware/auth.js";
import { upsertConversationSchema } from "../conversations/schemas.js";
import * as conversationService from "../conversations/service.js";
import { createOrderSchema } from "../orders/schemas.js";
import * as orderService from "../orders/service.js";
import * as restaurantService from "../restaurants/service.js";

export async function internalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireApiSecret);

  /**
   * Substitui o nó PostgreSQL do n8n: tenant + cardápio pela instância Evolution.
   * Use ?menu=slug para forçar um cardápio específico (fluxos diferentes por cardápio).
   */
  app.get("/internal/tenant/:instance", async (request, reply) => {
    const { instance } = request.params as { instance: string };
    const { menu } = request.query as { menu?: string };
    const tenant = await restaurantService.getTenantContext(instance, menu);
    if (!tenant) return reply.status(404).send({ error: "Restaurant not found" });
    return tenant;
  });

  /** Cardápio específico por slug — rota que o agente de IA consome por fluxo. */
  app.get("/internal/menu/:instance/:slug", async (request, reply) => {
    const { instance, slug } = request.params as { instance: string; slug: string };
    const tenant = await restaurantService.getTenantContext(instance, slug);
    if (!tenant) return reply.status(404).send({ error: "Restaurant not found" });
    if (!tenant.menu) return reply.status(404).send({ error: "Menu not found" });
    return tenant;
  });

  /** n8n salva pedido fechado pela IA. */
  app.post("/internal/orders", async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const restaurant = await restaurantService.getRestaurantByInstance(parsed.data.whatsappInstance);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const order = await orderService.createOrder({
      restaurantId: restaurant.id,
      customerPhone: parsed.data.customerPhone,
      orderDetails: parsed.data.orderDetails,
      status: parsed.data.status,
    });

    return reply.status(201).send(order);
  });

  /** n8n atualiza carrinho/modo da conversa durante o atendimento. */
  app.post("/internal/conversations/upsert", async (request, reply) => {
    const parsed = upsertConversationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const restaurant = await restaurantService.getRestaurantByInstance(parsed.data.whatsappInstance);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const conversation = await conversationService.upsertConversation(restaurant.id, parsed.data);
    return reply.status(200).send(conversation);
  });
}
