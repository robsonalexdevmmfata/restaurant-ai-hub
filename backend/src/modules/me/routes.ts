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
import { scheduleRestaurantEvent } from "../events/service.js";
import * as couponService from "../coupons/service.js";
import { createCouponSchema, updateCouponSchema } from "../coupons/schemas.js";
import { listOrdersQuerySchema, updateOrderStatusSchema } from "../orders/schemas.js";
import * as orderService from "../orders/service.js";
import * as restaurantAssetService from "../restaurants/assets.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productImageUploadSchema,
  updateProductSchema,
} from "../products/schemas.js";
import * as productService from "../products/service.js";
import {
  promotionUploadSchema,
  restaurantAssetUploadSchema,
  restaurantLogoUploadSchema,
  updateRestaurantSchema,
} from "../restaurants/schemas.js";
import * as restaurantService from "../restaurants/service.js";

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireJwt(request, reply);
    if (reply.sent) return;

    const { role } = getAuthUser(request);
    const route = (request.routeOptions.url ?? request.url.split("?")[0]).replace(
      /^\/api(?=\/)/,
      "",
    );
    const method = request.method;
    if (role === "owner" || role === "gerente") return;

    const canHandleOrders =
      (role === "cozinha" || role === "caixa" || role === "atendente") &&
      route.startsWith("/me/orders") &&
      (method === "GET" || (role === "cozinha" && method === "PATCH"));
    const canHandleConversations =
      role === "atendente" &&
      route.startsWith("/me/conversations") &&
      (method === "GET" || method === "PATCH");
    if (!canHandleOrders && !canHandleConversations) {
      return reply.status(403).send({ error: "Este perfil não tem acesso a esta operação" });
    }
  });

  app.get("/me/restaurant", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return restaurant;
  });

  app.patch("/me/restaurant", { bodyLimit: 2_200_000 }, async (request, reply) => {
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
        return reply.status(409).send({ error: "O slug ou a instância do WhatsApp já está em uso." });
      }
      throw error;
    }
  });

  app.post("/me/restaurant/logo", { bodyLimit: 1_500_000 }, async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = restaurantLogoUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Imagem inválida", details: parsed.error.flatten() });
    }
    const match = parsed.data.image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
    if (!match?.[2]) return reply.status(400).send({ error: "Imagem inválida" });
    const [, mimeType, encoded] = match;
    const image = Buffer.from(encoded, "base64");
    if (image.length === 0 || image.length > 1_000_000) {
      return reply.status(413).send({ error: "A logo deve ter no máximo 1 MB." });
    }
    const result = await restaurantService.saveRestaurantLogo(restaurantId, image, mimeType);
    if (!result) return reply.status(404).send({ error: "Restaurant not found" });
    return result;
  });

  app.delete("/me/restaurant/logo", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const restaurant = await restaurantService.deleteRestaurantLogo(restaurantId);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return restaurant;
  });

  app.post("/me/restaurant/assets/:kind", { bodyLimit: 1_500_000 }, async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const params = request.params as { kind: string };
    if (params.kind !== "cover" && params.kind !== "favicon") {
      return reply.status(400).send({ error: "Tipo de imagem inválido" });
    }
    const parsed = restaurantAssetUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Imagem inválida", details: parsed.error.flatten() });
    }
    const match = parsed.data.image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
    if (!match?.[2]) return reply.status(400).send({ error: "Imagem inválida" });
    const [, mimeType, encoded] = match;
    const image = Buffer.from(encoded, "base64");
    if (image.length === 0 || image.length > 1_000_000) {
      return reply.status(413).send({ error: "A imagem deve ter no máximo 1 MB." });
    }
    const result = await restaurantAssetService.saveBrandAsset(
      restaurantId,
      params.kind,
      image,
      mimeType,
    );
    if (!result) return reply.status(404).send({ error: "Restaurant not found" });
    return { [params.kind === "cover" ? "coverUrl" : "faviconUrl"]: result.url };
  });

  app.delete("/me/restaurant/assets/:kind", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const params = request.params as { kind: string };
    if (params.kind !== "cover" && params.kind !== "favicon") {
      return reply.status(400).send({ error: "Tipo de imagem inválido" });
    }
    const deleted = await restaurantAssetService.deleteBrandAsset(restaurantId, params.kind);
    if (!deleted) return reply.status(404).send({ error: "Imagem não encontrada" });
    return reply.status(204).send();
  });

  app.get("/me/promotions", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return restaurantAssetService.listPromotions(restaurantId, restaurant.slug);
  });

  app.post("/me/promotions", { bodyLimit: 1_500_000 }, async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = promotionUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Promoção inválida", details: parsed.error.flatten() });
    }
    const match = parsed.data.image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
    if (!match?.[2]) return reply.status(400).send({ error: "Imagem inválida" });
    const [, mimeType, encoded] = match;
    const image = Buffer.from(encoded, "base64");
    if (image.length === 0 || image.length > 1_000_000) {
      return reply.status(413).send({ error: "A imagem deve ter no máximo 1 MB." });
    }
    const promotion = await restaurantAssetService.createPromotion(
      restaurantId,
      parsed.data,
      image,
      mimeType,
    );
    return reply.status(201).send(promotion);
  });

  app.delete("/me/promotions/:promotionId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const promotionId = parseId((request.params as { promotionId: string }).promotionId);
    if (!promotionId) return reply.status(400).send({ error: "Invalid promotion id" });
    const deleted = await restaurantAssetService.deletePromotion(restaurantId, promotionId);
    if (!deleted) return reply.status(404).send({ error: "Promotion not found" });
    return reply.status(204).send();
  });

  app.get("/me/coupons", async (request) => {
    const { restaurantId } = getAuthUser(request);
    return couponService.listCoupons(restaurantId);
  });

  app.post("/me/coupons", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const parsed = createCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Cupom inválido", details: parsed.error.flatten() });
    }
    try {
      const coupon = await couponService.createCoupon(restaurantId, {
        ...parsed.data,
        value: parsed.data.value.toFixed(2),
      });
      return reply.status(201).send(coupon);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "Este código já existe para o restaurante." });
      }
      throw error;
    }
  });

  app.patch("/me/coupons/:couponId", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const couponId = parseId((request.params as { couponId: string }).couponId);
    if (!couponId) return reply.status(400).send({ error: "ID do cupom inválido." });
    const parsed = updateCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Atualização inválida", details: parsed.error.flatten() });
    }
    const coupon = await couponService.updateCoupon(restaurantId, couponId, parsed.data.active);
    if (!coupon) return reply.status(404).send({ error: "Cupom não encontrado." });
    return coupon;
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

  app.post("/me/products/:productId/image", { bodyLimit: 2_200_000 }, async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const productId = parseId((request.params as { productId: string }).productId);
    if (!productId) return reply.status(400).send({ error: "Invalid product id" });

    const parsed = productImageUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Imagem inválida", details: parsed.error.flatten() });
    }
    const encoded = parsed.data.image.slice("data:image/jpeg;base64,".length);
    const image = Buffer.from(encoded, "base64");
    if (image.length === 0 || image.length > 1_500_000) {
      return reply.status(413).send({ error: "A imagem otimizada deve ter no máximo 1,5 MB." });
    }

    const result = await productService.saveProductImage(
      productId,
      restaurantId,
      image,
      "image/jpeg",
    );
    if (!result) return reply.status(404).send({ error: "Product not found" });
    return result;
  });

  app.delete("/me/products/:productId/image", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const productId = parseId((request.params as { productId: string }).productId);
    if (!productId) return reply.status(400).send({ error: "Invalid product id" });

    const deleted = await productService.deleteProductImage(productId, restaurantId);
    if (!deleted) return reply.status(404).send({ error: "Product not found" });
    return reply.status(204).send();
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

  app.get("/me/orders/:orderId/status-history", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const history = await orderService.listOrderStatusHistory(orderId, restaurantId);
    if (!history) return reply.status(404).send({ error: "Order not found" });
    return history;
  });

  app.patch("/me/orders/:orderId", async (request, reply) => {
    const { restaurantId, sub } = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const parsed = updateOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const result = await orderService.updateOrderStatus(orderId, restaurantId, parsed.data, sub);
    if (!result) return reply.status(404).send({ error: "Order not found" });
    if ("conflict" in result) {
      return reply.status(409).send({
        error:
          "O status do pedido foi alterado por outro operador. Atualize a cozinha antes de tentar novamente.",
        currentStatus: result.currentStatus,
      });
    }
    if (!result.unchanged) {
      scheduleRestaurantEvent(
        restaurantId,
        "ORDER_STATUS_CHANGED",
        {
          orderId: result.order.id,
          previousStatus: result.previousStatus,
          newStatus: result.order.status,
          customerName: result.order.customerName,
          customerPhone: result.order.customerPhone,
          source: result.order.source,
          tableId: result.order.tableId,
          total: result.order.total,
        },
        request.log,
      );
    }
    return result.order;
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

    const conversation = await conversationService.updateConversationMode(
      id,
      restaurantId,
      parsed.data,
    );
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

    const conversation = await conversationService.updateConversationCart(
      id,
      restaurantId,
      parsed.data,
    );
    if (!conversation) return reply.status(404).send({ error: "Conversation not found" });
    return conversation;
  });
}
