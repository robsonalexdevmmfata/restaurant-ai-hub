import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { restaurants } from "../../db/schema.js";
import * as menuService from "../menus/service.js";
import * as productService from "../products/service.js";
import type { UpdateRestaurantInput } from "./schemas.js";

export async function getRestaurantById(id: number) {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
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
  const [row] = await db
    .update(restaurants)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.whatsappInstance !== undefined && { whatsappInstance: input.whatsappInstance }),
      ...(input.aiInstructions !== undefined && { aiInstructions: input.aiInstructions }),
    })
    .where(eq(restaurants.id, id))
    .returning();
  return row ?? null;
}
