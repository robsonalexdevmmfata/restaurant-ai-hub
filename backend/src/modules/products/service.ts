import { and, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import type { CreateProductInput, UpdateProductInput } from "./schemas.js";

export async function listProductsByRestaurant(restaurantId: number, menuId?: number) {
  const conditions = [eq(products.restaurantId, restaurantId)];
  if (menuId) conditions.push(eq(products.menuId, menuId));

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(products.category, products.name);
}

export async function listProductsByMenu(menuId: number) {
  return db
    .select()
    .from(products)
    .where(eq(products.menuId, menuId))
    .orderBy(products.category, products.name);
}

export async function getProductById(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function createProduct(
  restaurantId: number,
  input: CreateProductInput,
  menuId: number | null,
) {
  const [row] = await db
    .insert(products)
    .values({
      restaurantId,
      menuId,
      name: input.name,
      description: input.description ?? null,
      price: input.price.toFixed(2),
      category: input.category ?? null,
      status: input.status,
    })
    .returning();
  return row;
}

export async function updateProduct(id: number, restaurantId: number, input: UpdateProductInput) {
  const [row] = await db
    .update(products)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price !== undefined && { price: input.price.toFixed(2) }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.menuId !== undefined && { menuId: input.menuId }),
    })
    .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}

export async function deleteProduct(id: number, restaurantId: number) {
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)))
    .returning({ id: products.id });
  return row ?? null;
}
