import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { restaurantImages, restaurants } from "../../db/schema.js";
import * as menuService from "../menus/service.js";
import * as productService from "../products/service.js";
import type { UpdateRestaurantInput } from "./schemas.js";

export async function getRestaurantById(id: number) {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
  return row ?? null;
}

export async function getRestaurantBySlug(slug: string) {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRestaurantByInstance(instance: string) {
  const [row] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.whatsappInstance, instance))
    .limit(1);
  return row ?? null;
}

/**
 * Contexto usado pelo agente de IA (n8n / Evolution API).
 * Quando `menuSlug` é informado, usa aquele cardápio; senão usa o cardápio ativo.
 */
export async function getTenantContext(instance: string, menuSlug?: string) {
  const restaurant = await getRestaurantByInstance(instance);
  if (!restaurant) return null;

  const menu = menuSlug
    ? await menuService.getMenuBySlug(restaurant.id, menuSlug)
    : await menuService.getActiveMenu(restaurant.id);

  if (menuSlug && !menu) return { restaurant, menu: null, products: [] };

  const menuProducts = menu
    ? await productService.listProductsByMenu(menu.id)
    : await productService.listProductsByRestaurant(restaurant.id);

  const available = menuProducts.filter((p) => p.status === "DISPONIVEL");

  return {
    restaurant,
    menu,
    aiInstructions: menu?.aiInstructions ?? restaurant.aiInstructions ?? null,
    products: menuProducts,
    menuText: available
      .map(
        (p) =>
          `- ${p.name}${p.category ? ` (${p.category})` : ""}: R$ ${Number(p.price).toFixed(2)}${
            p.description ? ` — ${p.description}` : ""
          }`,
      )
      .join("\n"),
  };
}

export async function updateRestaurant(id: number, input: UpdateRestaurantInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        slug: restaurants.slug,
        logoUrl: restaurants.logoUrl,
        coverUrl: restaurants.coverUrl,
        faviconUrl: restaurants.faviconUrl,
      })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .for("update")
      .limit(1);
    if (!current) return null;

    const slug = input.slug ?? current.slug;
    const updateAssetSlug = (url: string | null) => {
      const previousPrefix = `/public/restaurants/${current.slug}/`;
      return url?.startsWith(previousPrefix)
        ? `/public/restaurants/${slug}/${url.slice(previousPrefix.length)}`
        : url;
    };
    const [row] = await tx
      .update(restaurants)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && {
          slug,
          logoUrl: updateAssetSlug(current.logoUrl),
          coverUrl: updateAssetSlug(current.coverUrl),
          faviconUrl: updateAssetSlug(current.faviconUrl),
        }),
        ...(input.whatsappInstance !== undefined && { whatsappInstance: input.whatsappInstance }),
        ...(input.aiInstructions !== undefined && { aiInstructions: input.aiInstructions }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.whatsapp !== undefined && { whatsapp: input.whatsapp }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.openingHours !== undefined && { openingHours: input.openingHours }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.webhookUrl !== undefined && { webhookUrl: input.webhookUrl }),
        ...(input.publicPolicy !== undefined && { publicPolicy: input.publicPolicy }),
        ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
        ...(input.faviconUrl !== undefined && { faviconUrl: input.faviconUrl }),
        ...(input.cnpj !== undefined && { cnpj: input.cnpj }),
      })
      .where(eq(restaurants.id, id))
      .returning();
    return row ?? null;
  });
}

export async function saveRestaurantLogo(id: number, data: Buffer, mimeType: string) {
  return db.transaction(async (tx) => {
    const [restaurant] = await tx
      .select({ slug: restaurants.slug })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    if (!restaurant) return null;

    await tx
      .insert(restaurantImages)
      .values({ restaurantId: id, mimeType, data })
      .onConflictDoUpdate({
        target: restaurantImages.restaurantId,
        set: { mimeType, data, updatedAt: new Date() },
      });

    const logoUrl = `/public/restaurants/${restaurant.slug}/logo?v=${Date.now()}`;
    const [updated] = await tx
      .update(restaurants)
      .set({ logoUrl })
      .where(eq(restaurants.id, id))
      .returning({ logoUrl: restaurants.logoUrl });
    return updated ?? null;
  });
}

export async function deleteRestaurantLogo(id: number) {
  return db.transaction(async (tx) => {
    const [restaurant] = await tx
      .select({ logoUrl: restaurants.logoUrl })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    if (!restaurant) return null;

    await tx.delete(restaurantImages).where(eq(restaurantImages.restaurantId, id));
    if (restaurant.logoUrl?.startsWith("/public/restaurants/")) {
      const [updated] = await tx
        .update(restaurants)
        .set({ logoUrl: null })
        .where(eq(restaurants.id, id))
        .returning({ logoUrl: restaurants.logoUrl });
      return updated ?? null;
    }
    return restaurant;
  });
}
