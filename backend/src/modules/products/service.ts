import { and, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { productImages, products } from "../../db/schema.js";
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
      imageUrl: input.imageUrl ?? null,
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
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
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

export async function saveProductImage(
  id: number,
  restaurantId: number,
  data: Buffer,
  mimeType: string,
) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)))
      .limit(1);
    if (!product) return null;

    await tx
      .insert(productImages)
      .values({ productId: id, restaurantId, mimeType, data })
      .onConflictDoUpdate({
        target: productImages.productId,
        set: { restaurantId, mimeType, data, updatedAt: new Date() },
      });
    const imageUrl = `/public/products/${id}/image?v=${Date.now()}`;
    await tx
      .update(products)
      .set({ imageUrl })
      .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)));
    return { imageUrl };
  });
}

export async function deleteProductImage(id: number, restaurantId: number) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id, imageUrl: products.imageUrl })
      .from(products)
      .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)))
      .limit(1);
    if (!product) return false;

    await tx
      .delete(productImages)
      .where(and(eq(productImages.productId, id), eq(productImages.restaurantId, restaurantId)));
    if (product.imageUrl?.startsWith(`/public/products/${id}/image`)) {
      await tx
        .update(products)
        .set({ imageUrl: null })
        .where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)));
    }
    return true;
  });
}
