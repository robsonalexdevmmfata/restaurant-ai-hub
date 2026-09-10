import type { FastifyInstance } from "fastify";

import { isUniqueViolation, parseId } from "../../lib/helpers.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";
import {
  updateConversationCartSchema,
  updateConversationModeSchema,
} from "../conversations/schemas.js";
import * as conversationService from "../conversations/service.js";
import { createMenuSchema, updateMenuSchema } from "../menus/schemas.js";
import * as menuService from "../menus/service.js";
import { listOrdersQuerySchema, updateOrderStatusSchema } from "../orders/schemas.js";
import * as orderService from "../orders/service.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../products/schemas.js";
import * as productService from "../products/service.js";
import { updateRestaurantSchema } from "../restaurants/schemas.js";
import * as restaurantService from "../restaurants/service.js";

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireJwt);

  app.get("/me/restaurant", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return restaurant;
  });

  app.patch("/me/restaurant", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = updateRestaurantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    try {
      const restaurant = await restaurantService.updateRestaurant(restaurantId, parsed.data);
      if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
      return restaurant;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "whatsapp_instance already exists" });
      }
      throw error;
    }
  });

  app.get("/me/dashboard/stats", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return orderService.getDashboardStats(restaurantId);
  });

  /* ---------- Cardápios (menus) ---------- */

  app.get("/me/menus", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return menuService.listMenus(restaurantId);
  });

  app.post("/me/menus", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = createMenuSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    try {
      const menu = await menuService.createMenu(restaurantId, parsed.data);
      return reply.status(201).send(menu);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "Já existe um cardápio com esse identificador" });
      }
      throw error;
    }
  });

  app.patch("/me/menus/:menuId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const menuId = parseId((request.params as { menuId: string }).menuId);
    if (!menuId) return reply.status(400).send({ error: "Invalid menu id" });

    const parsed = updateMenuSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    try {
      const menu = await menuService.updateMenu(menuId, restaurantId, parsed.data);
      if (!menu) return reply.status(404).send({ error: "Menu not found" });
      return menu;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "Já existe um cardápio com esse identificador" });
      }
      throw error;
    }
  });

  app.delete("/me/menus/:menuId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const menuId = parseId((request.params as { menuId: string }).menuId);
    if (!menuId) return reply.status(400).send({ error: "Invalid menu id" });

    const deleted = await menuService.deleteMenu(menuId, restaurantId);
    if (!deleted) return reply.status(404).send({ error: "Menu not found" });
    return reply.status(204).send();
  });

  /* ---------- Produtos ---------- */

  app.get("/me/products", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = listProductsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    }
    return productService.listProductsByRestaurant(restaurantId, parsed.data.menuId);
  });

  app.post("/me/products", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    let menuId = parsed.data.menuId ?? null;
    if (menuId) {
      const menu = await menuService.getMenu(menuId, restaurantId);
      if (!menu) return reply.status(404).send({ error: "Menu not found" });
    } else {
      const active = await menuService.getActiveMenu(restaurantId);
      menuId = active?.id ?? null;
    }

    const product = await productService.createProduct(restaurantId, parsed.data, menuId);
    return reply.status(201).send(product);
  });

  app.patch("/me/products/:productId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const productId = parseId((request.params as { productId: string }).productId);
    if (!productId) return reply.status(400).send({ error: "Invalid product id" });

    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const product = await productService.updateProduct(productId, restaurantId, parsed.data);
    if (!product) return reply.status(404).send({ error: "Product not found" });
    return product;
  });

  app.delete("/me/products/:productId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const productId = parseId((request.params as { productId: string }).productId);
    if (!productId) return reply.status(400).send({ error: "Invalid product id" });

    const deleted = await productService.deleteProduct(productId, restaurantId);
    if (!deleted) return reply.status(404).send({ error: "Product not found" });
    return reply.status(204).send();
  });

  app.get("/me/orders", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
    }
    return orderService.listOrdersByRestaurant(restaurantId, parsed.data);
  });

  app.patch("/me/orders/:orderId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const parsed = updateOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const order = await orderService.updateOrderStatus(orderId, restaurantId, parsed.data);
    if (!order) return reply.status(404).send({ error: "Order not found" });
    return order;
  });

  app.get("/me/orders/stream", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const since = Number((request.query as { since?: string }).since ?? 0);
    let lastId = Number.isFinite(since) ? since : 0;

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(": connected\n\n");

    const interval = setInterval(async () => {
      try {
        const fresh = await orderService.listOrdersSince(restaurantId, lastId);
        for (const order of fresh.reverse()) {
          lastId = Math.max(lastId, order.id);
          reply.raw.write(`event: order\n`);
          reply.raw.write(`data: ${JSON.stringify(order)}\n\n`);
        }
      } catch (error) {
        request.log.error(error);
      }
    }, 3000);

    request.raw.on("close", () => clearInterval(interval));
  });

  app.get("/me/conversations", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return conversationService.listConversationsByRestaurant(restaurantId);
  });

  app.get("/me/conversations/:id", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const id = parseId((request.params as { id: string }).id);
    if (!id) return reply.status(400).send({ error: "Invalid id" });

    const conversation = await conversationService.getConversationById(id, restaurantId);
    if (!conversation) return reply.status(404).send({ error: "Conversation not found" });
    return conversation;
  });

  app.patch("/me/conversations/:id/mode", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const id = parseId((request.params as { id: string }).id);
    if (!id) return reply.status(400).send({ error: "Invalid id" });

    const parsed = updateConversationModeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const conversation = await conversationService.updateConversationMode(id, restaurantId, parsed.data);
    if (!conversation) return reply.status(404).send({ error: "Conversation not found" });
    return conversation;
  });

  app.patch("/me/conversations/:id/cart", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const id = parseId((request.params as { id: string }).id);
    if (!id) return reply.status(400).send({ error: "Invalid id" });

    const parsed = updateConversationCartSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const conversation = await conversationService.updateConversationCart(id, restaurantId, parsed.data);
    if (!conversation) return reply.status(404).send({ error: "Conversation not found" });
    return conversation;
  });
}
