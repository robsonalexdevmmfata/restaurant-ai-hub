import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/index.js";
import { menus, products, restaurants } from "../../db/schema.js";
import * as tableService from "../tables/service.js";
import { orders } from "../../db/schema.js";

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(280).optional(),
});

const publicOrderSchema = z.object({
  tableLabel: z.string().min(1).max(60).optional(),
  customerName: z.string().max(255).optional(),
  customerPhone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1),
});

/** Rotas abertas usadas pelo cardápio digital do cliente (QR Code da mesa). */
export async function publicRoutes(app: FastifyInstance) {
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
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        address: restaurant.address,
        city: restaurant.city,
        state: restaurant.state,
        openingHours: restaurant.openingHours,
        isOpen: restaurant.isOpen,
      },
      menu: menu ? { id: menu.id, name: menu.name, slug: menu.slug } : null,
      products: items,
      tables: tables.filter((t) => t.isActive).map((t) => ({ id: t.id, label: t.label })),
    };
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
    let tableId: number | null = null;
    let sessionId: number | null = null;

    if (input.tableLabel) {
      const table = await tableService.getTableByLabel(restaurant.id, input.tableLabel);
      if (!table || !table.isActive) {
        return reply.status(404).send({ error: "Mesa não encontrada" });
      }
      tableId = table.id;
      const session = await tableService.ensureOpenSession(table.id, restaurant.id);
      sessionId = session?.id ?? null;
    }

    const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const details = input.items
      .map((item) => `${item.quantity}x ${item.name}${item.notes ? ` (${item.notes})` : ""}`)
      .join(", ");

    const [order] = await db
      .insert(orders)
      .values({
        restaurantId: restaurant.id,
        tableId,
        sessionId,
        source: tableId ? "qrcode" : "delivery",
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        orderDetails: details,
        itemsJson: input.items,
        total: total.toFixed(2),
        notes: input.notes ?? null,
        status: "PENDENTE",
      })
      .returning();

    return reply.status(201).send({ order, total });
  });
}
