import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { products, restaurants } from "../../db/schema.js";
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

export async function getTenantContext(instance: string) {
  const restaurant = await getRestaurantByInstance(instance);
  if (!restaurant) return null;

  const menu = await db
    .select()
    .from(products)
    .where(eq(products.restaurantId, restaurant.id));

  return { restaurant, products: menu };
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
