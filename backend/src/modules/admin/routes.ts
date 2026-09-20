import { asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { db } from "../../db/index.js";
import { conversations, orders, products, restaurants, users } from "../../db/schema.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";

/** Super admin da plataforma: visão global de todos os restaurantes. */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireJwt);
  app.addHook("preHandler", async (request, reply) => {
    const auth = getAuthUser(request);
    if (auth.role !== "superadmin") {
      return reply.status(403).send({ error: "Acesso restrito ao super admin" });
    }
  });

  app.get("/admin/metrics", async () => {
    const [totals] = await db
      .select({
        restaurants: sql<number>`(select count(*)::int from ${restaurants})`,
        users: sql<number>`(select count(*)::int from ${users})`,
        products: sql<number>`(select count(*)::int from ${products})`,
        conversations: sql<number>`(select count(*)::int from ${conversations})`,
        orders: sql<number>`(select count(*)::int from ${orders})`,
        revenue: sql<string>`(select coalesce(sum(total), 0)::text from ${orders})`,
      })
      .from(sql`(select 1) as t`);

    return { ...totals, revenue: Number(totals?.revenue ?? 0) };
  });

  app.get("/admin/restaurants", async () => {
    const rows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        city: restaurants.city,
        state: restaurants.state,
        isOpen: restaurants.isOpen,
        whatsappInstance: restaurants.whatsappInstance,
        userCount: sql<number>`(select count(*)::int from ${users} u where u.restaurant_id = ${restaurants.id})`,
        orderCount: sql<number>`(select count(*)::int from ${orders} o where o.restaurant_id = ${restaurants.id})`,
        revenue: sql<string>`(select coalesce(sum(o.total), 0)::text from ${orders} o where o.restaurant_id = ${restaurants.id})`,
      })
      .from(restaurants)
      .orderBy(asc(restaurants.name));

    return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
  });

  app.patch("/admin/restaurants/:id/status", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const isOpen = Boolean((request.body as { isOpen?: boolean }).isOpen);
    if (!Number.isInteger(id)) return reply.status(400).send({ error: "Invalid id" });

    const [row] = await db
      .update(restaurants)
      .set({ isOpen })
      .where(eq(restaurants.id, id))
      .returning();
    if (!row) return reply.status(404).send({ error: "Restaurant not found" });
    return row;
  });
}
