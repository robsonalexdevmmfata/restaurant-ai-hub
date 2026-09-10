import { and, asc, eq, ne, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { menus, products } from "../../db/schema.js";
import { slugify, type CreateMenuInput, type UpdateMenuInput } from "./schemas.js";

export async function listMenus(restaurantId: number) {
  return db
    .select({
      id: menus.id,
      restaurantId: menus.restaurantId,
      name: menus.name,
      slug: menus.slug,
      aiInstructions: menus.aiInstructions,
      isActive: menus.isActive,
      createdAt: menus.createdAt,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.menu_id = ${menus.id})`,
    })
    .from(menus)
    .where(eq(menus.restaurantId, restaurantId))
    .orderBy(asc(menus.createdAt));
}

export async function getMenu(id: number, restaurantId: number) {
  const [row] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.id, id), eq(menus.restaurantId, restaurantId)))
    .limit(1);
  return row ?? null;
}

export async function getActiveMenu(restaurantId: number) {
  const [active] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.restaurantId, restaurantId), eq(menus.isActive, true)))
    .limit(1);
  if (active) return active;

  const [first] = await db
    .select()
    .from(menus)
    .where(eq(menus.restaurantId, restaurantId))
    .orderBy(asc(menus.createdAt))
    .limit(1);
  return first ?? null;
}

export async function getMenuBySlug(restaurantId: number, slug: string) {
  const [row] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.restaurantId, restaurantId), eq(menus.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function createMenu(restaurantId: number, input: CreateMenuInput) {
  const slug = input.slug ?? slugify(input.name);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(menus)
      .values({
        restaurantId,
        name: input.name,
        slug,
        aiInstructions: input.aiInstructions ?? null,
        isActive: input.isActive,
      })
      .returning();

    if (row && input.isActive) {
      await tx
        .update(menus)
        .set({ isActive: false })
        .where(and(eq(menus.restaurantId, restaurantId), ne(menus.id, row.id)));
    }

    return row;
  });
}

export async function updateMenu(id: number, restaurantId: number, input: UpdateMenuInput) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(menus)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.aiInstructions !== undefined && { aiInstructions: input.aiInstructions }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      })
      .where(and(eq(menus.id, id), eq(menus.restaurantId, restaurantId)))
      .returning();

    if (row && input.isActive === true) {
      await tx
        .update(menus)
        .set({ isActive: false })
        .where(and(eq(menus.restaurantId, restaurantId), ne(menus.id, row.id)));
    }

    return row ?? null;
  });
}

/** Remove o cardápio e os produtos dele (cascade). Nunca deixa o restaurante sem cardápio ativo. */
export async function deleteMenu(id: number, restaurantId: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(menus)
      .where(and(eq(menus.id, id), eq(menus.restaurantId, restaurantId)))
      .returning({ id: menus.id, isActive: menus.isActive });

    if (!row) return null;

    if (row.isActive) {
      const [next] = await tx
        .select({ id: menus.id })
        .from(menus)
        .where(eq(menus.restaurantId, restaurantId))
        .orderBy(asc(menus.createdAt))
        .limit(1);
      if (next) {
        await tx.update(menus).set({ isActive: true }).where(eq(menus.id, next.id));
      }
    }

    return row;
  });
}
