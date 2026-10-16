import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/index.js";
import {
  menus,
  orders,
  productImages,
  products,
  restaurantAssets,
  restaurantImages,
  restaurants,
} from "../../db/schema.js";
import { scheduleRestaurantEvent } from "../events/service.js";
import * as couponService from "../coupons/service.js";
import {
  ClosedTableSessionError,
  createOrderWithHistory,
  InvalidCouponError,
} from "../orders/service.js";
import * as restaurantAssetService from "../restaurants/assets.js";
import * as tableService from "../tables/service.js";

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(280).optional(),
});

const publicOrderSchema = z.object({
  tableLabel: z.string().min(1).max(60).optional(),
  customerName: z.string().trim().min(2).max(255).optional(),
  customerPhone: z.string().trim().min(10).max(30).optional(),
  couponCode: z.string().trim().max(80).optional(),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao", "outros"]).optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryNeighborhood: z.string().max(120).optional(),
  deliveryPostalCode: z.string().max(12).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1),
});

/** Rotas abertas usadas pelo cardápio digital do cliente (QR Code da mesa). */
export async function publicRoutes(app: FastifyInstance) {
  app.post("/public/restaurants/:slug/tables/:tableLabel/open", async (request, reply) => {
    const params = z
      .object({
        slug: z.string().min(1).max(160),
        tableLabel: z.string().min(1).max(60),
      })
      .safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Link de mesa inválido" });

    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.data.slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });
    const result = await tableService.ensurePublicTableSession(
      restaurant.id,
      params.data.tableLabel,
    );
    if (!result) return reply.status(404).send({ error: "Mesa indisponível" });
    return { session: { id: result.session.id, tableLabel: result.table.label } };
  });

  app.get("/public/restaurants/:slug/tables/:tableLabel", async (request, reply) => {
    const params = z
      .object({
        slug: z.string().min(1).max(160),
        tableLabel: z.string().min(1).max(60),
      })
      .safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Link de mesa inválido" });

    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.data.slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });
    return tableService.getPublicTableSession(restaurant.id, params.data.tableLabel);
  });

  app.post("/public/restaurants/:slug/tables/:tableLabel/close-request", async (request, reply) => {
    const params = z
      .object({
        slug: z.string().min(1).max(160),
        tableLabel: z.string().min(1).max(60),
      })
      .safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Link de mesa inválido" });

    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.data.slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });
    const session = await tableService.requestTableClosure(restaurant.id, params.data.tableLabel);
    if (!session)
      return reply.status(409).send({ error: "Não há uma comanda aberta para esta mesa" });
    scheduleRestaurantEvent(
      restaurant.id,
      "TABLE_CLOSE_REQUESTED",
      {
        tableLabel: params.data.tableLabel,
        sessionId: session.session?.id ?? null,
        total: session.total,
      },
      request.log,
    );
    return session;
  });

  app.get("/public/restaurants/:slug/tables/:tableLabel/stream", async (request, reply) => {
    const params = z
      .object({
        slug: z.string().min(1).max(160),
        tableLabel: z.string().min(1).max(60),
      })
      .safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Link de mesa inválido" });
    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.data.slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let previous = "";
    let active = true;
    const sendSnapshot = async () => {
      const snapshot = await tableService.getPublicTableSession(
        restaurant.id,
        params.data.tableLabel,
      );
      const serialized = JSON.stringify(snapshot);
      if (serialized === previous || !active) return;
      previous = serialized;
      reply.raw.write(`event: table\n`);
      reply.raw.write(`data: ${serialized}\n\n`);
    };
    void sendSnapshot().catch((error: unknown) => request.log.error(error));
    const interval = setInterval(() => {
      void sendSnapshot().catch((error: unknown) => request.log.error(error));
    }, 3000);
    request.raw.on("close", () => {
      active = false;
      clearInterval(interval);
    });
  });

  app.get("/public/restaurants/:slug/logo", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const [image] = await db
      .select({ data: restaurantImages.data, mimeType: restaurantImages.mimeType })
      .from(restaurantImages)
      .innerJoin(restaurants, eq(restaurantImages.restaurantId, restaurants.id))
      .where(eq(restaurants.slug, slug))
      .limit(1);
    if (!image) return reply.status(404).send({ error: "Logo não encontrada" });

    return reply
      .type(image.mimeType)
      .header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
      .header("X-Content-Type-Options", "nosniff")
      .send(image.data);
  });

  app.get("/public/restaurants/:slug/assets/:assetId/image", async (request, reply) => {
    const params = z
      .object({
        slug: z.string().min(1).max(160),
        assetId: z.coerce.number().int().positive(),
      })
      .safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: "Imagem não encontrada" });
    const [image] = await db
      .select({ data: restaurantAssets.data, mimeType: restaurantAssets.mimeType })
      .from(restaurantAssets)
      .innerJoin(restaurants, eq(restaurantAssets.restaurantId, restaurants.id))
      .where(
        and(eq(restaurantAssets.id, params.data.assetId), eq(restaurants.slug, params.data.slug)),
      )
      .limit(1);
    if (!image) return reply.status(404).send({ error: "Imagem não encontrada" });
    return reply
      .type(image.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(image.data);
  });

  app.get("/public/products/:productId/image", async (request, reply) => {
    const productId = Number((request.params as { productId: string }).productId);
    if (!Number.isSafeInteger(productId) || productId < 1) {
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }
    const [image] = await db
      .select({ data: productImages.data, mimeType: productImages.mimeType })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .limit(1);
    if (!image) return reply.status(404).send({ error: "Imagem não encontrada" });

    return reply
      .type(image.mimeType)
      .header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
      .header("X-Content-Type-Options", "nosniff")
      .send(image.data);
  });

  app.get("/public/restaurants/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const menuSlug = (request.query as { menu?: string }).menu;

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });

    const menuRows = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurant.id))
      .orderBy(asc(menus.createdAt));

    const menu =
      (menuSlug ? menuRows.find((m) => m.slug === menuSlug) : menuRows.find((m) => m.isActive)) ??
      menuRows[0] ??
      null;

    const items = menu
      ? await db
          .select()
          .from(products)
          .where(and(eq(products.menuId, menu.id), eq(products.status, "DISPONIVEL")))
          .orderBy(asc(products.category), asc(products.name))
      : [];

    const tables = await tableService.listTables(restaurant.id);

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        logoUrl: restaurant.logoUrl,
        coverUrl: restaurant.coverUrl,
        primaryColor: restaurant.primaryColor,
        faviconUrl: restaurant.faviconUrl,
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        address: restaurant.address,
        city: restaurant.city,
        state: restaurant.state,
        openingHours: restaurant.openingHours,
        publicPolicy: restaurant.publicPolicy,
        isOpen: restaurant.isOpen,
      },
      menu: menu ? { id: menu.id, name: menu.name, slug: menu.slug } : null,
      products: items,
      promotions: await restaurantAssetService.listPublicPromotions(restaurant.id, restaurant.slug),
      tables: tables.filter((t) => t.isActive).map((t) => ({ id: t.id, label: t.label })),
    };
  });

  app.get("/public/restaurants/:slug/coupons", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });
    return couponService.listCoupons(restaurant.id, true);
  });

  app.post("/public/restaurants/:slug/orders", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = publicOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Pedido inválido", details: parsed.error.flatten() });
    }

    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurante não encontrado" });
    if (!restaurant.isOpen) return reply.status(409).send({ error: "Restaurante fechado" });

    const input = parsed.data;
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const menuProducts = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        status: products.status,
      })
      .from(products)
      .innerJoin(menus, eq(products.menuId, menus.id))
      .where(and(inArray(products.id, productIds), eq(menus.restaurantId, restaurant.id)));

    if (
      menuProducts.length !== productIds.length ||
      menuProducts.some((product) => product.status !== "DISPONIVEL")
    ) {
      return reply
        .status(409)
        .send({ error: "Um ou mais produtos não estão mais disponíveis. Atualize o cardápio." });
    }

    const currentProducts = new Map(menuProducts.map((product) => [product.id, product]));
    const changedPrices = input.items.flatMap((item) => {
      const product = currentProducts.get(item.productId)!;
      return Math.round(Number(product.price) * 100) !== Math.round(item.price * 100)
        ? [{ productId: product.id, name: product.name, price: Number(product.price) }]
        : [];
    });
    if (changedPrices.length) {
      return reply.status(409).send({
        error: "O preço de um produto mudou. Revise o carrinho antes de confirmar.",
        changedPrices,
      });
    }

    const items = input.items.map((item) => {
      const product = currentProducts.get(item.productId)!;
      return {
        ...item,
        name: product.name,
        price: Number(product.price),
      };
    });
    let tableId: number | null = null;
    let sessionId: number | null = null;

    if (input.tableLabel) {
      const table = await tableService.getTableByLabel(restaurant.id, input.tableLabel);
      if (!table || !table.isActive) {
        return reply.status(404).send({ error: "Mesa não encontrada" });
      }
      const session = await tableService.getOpenSession(table.id, restaurant.id);
      if (!session)
        return reply.status(409).send({
          error:
            "A comanda foi encerrada. Reabra o cardápio da mesa para iniciar uma nova comanda.",
        });
      tableId = table.id;
      sessionId = session.id;
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const details = items
      .map((item) => `${item.quantity}x ${item.name}${item.notes ? ` (${item.notes})` : ""}`)
      .join(", ");
    const trackingToken = randomUUID();

    let order: Awaited<ReturnType<typeof createOrderWithHistory>>;
    try {
      order = await createOrderWithHistory(
        {
          restaurantId: restaurant.id,
          tableId,
          sessionId,
          source: tableId ? "qrcode" : "delivery",
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          orderDetails: details,
          itemsJson: items,
          total: total.toFixed(2),
          notes: input.notes ?? null,
          paymentMethod: input.paymentMethod ?? null,
          deliveryAddress: input.deliveryAddress ?? null,
          deliveryNeighborhood: input.deliveryNeighborhood ?? null,
          deliveryPostalCode: input.deliveryPostalCode ?? null,
          status: "PENDENTE",
          trackingToken,
        },
        "public_menu",
        input.couponCode,
      );
    } catch (error) {
      if (error instanceof ClosedTableSessionError) {
        return reply.status(409).send({ error: error.message });
      }
      if (error instanceof InvalidCouponError) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }

    scheduleRestaurantEvent(
      restaurant.id,
      "ORDER_CREATED",
      {
        orderId: order.id,
        source: order.source,
        tableLabel: input.tableLabel ?? null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items,
        total: order.total,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        paymentMethod: order.paymentMethod,
        status: order.status,
      },
      request.log,
    );
    return reply.status(201).send({
      id: order.id,
      sessionId,
      total: Number(order.total),
      couponCode: order.couponCode,
      couponDiscount: Number(order.couponDiscount),
      trackingToken,
    });
  });

  app.get("/public/order-tracking/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return reply.status(404).send({ error: "Pedido não encontrado" });
    }

    const [order] = await db
      .select({
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.trackingToken, token))
      .limit(1);

    if (!order) return reply.status(404).send({ error: "Pedido não encontrado" });
    return order;
  });
}
