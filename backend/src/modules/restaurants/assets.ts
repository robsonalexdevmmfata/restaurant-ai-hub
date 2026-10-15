import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { restaurantAssets, restaurants } from "../../db/schema.js";

export type BrandAssetKind = "cover" | "favicon";

function publicAssetUrl(slug: string, id: number) {
  return `/public/restaurants/${slug}/assets/${id}/image?v=${Date.now()}`;
}

export async function saveBrandAsset(
  restaurantId: number,
  kind: BrandAssetKind,
  data: Buffer,
  mimeType: string,
) {
  return db.transaction(async (tx) => {
    const [restaurant] = await tx
      .select({ slug: restaurants.slug })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .for("update")
      .limit(1);
    if (!restaurant) return null;

    const [existing] = await tx
      .select({ id: restaurantAssets.id })
      .from(restaurantAssets)
      .where(and(eq(restaurantAssets.restaurantId, restaurantId), eq(restaurantAssets.kind, kind)))
      .limit(1);

    let assetId = existing?.id;
    if (assetId) {
      await tx
        .update(restaurantAssets)
        .set({ data, mimeType, updatedAt: new Date() })
        .where(eq(restaurantAssets.id, assetId));
    } else {
      const [asset] = await tx
        .insert(restaurantAssets)
        .values({ restaurantId, kind, data, mimeType })
        .returning({ id: restaurantAssets.id });
      assetId = asset?.id;
    }
    if (!assetId) throw new Error("Restaurant asset was not saved");

    const url = publicAssetUrl(restaurant.slug, assetId);
    await tx
      .update(restaurants)
      .set(kind === "cover" ? { coverUrl: url } : { faviconUrl: url })
      .where(eq(restaurants.id, restaurantId));
    return { url };
  });
}

export async function deleteBrandAsset(restaurantId: number, kind: BrandAssetKind) {
  return db.transaction(async (tx) => {
    const [asset] = await tx
      .select({ id: restaurantAssets.id })
      .from(restaurantAssets)
      .where(and(eq(restaurantAssets.restaurantId, restaurantId), eq(restaurantAssets.kind, kind)))
      .limit(1);
    if (!asset) return false;

    await tx.delete(restaurantAssets).where(eq(restaurantAssets.id, asset.id));
    await tx
      .update(restaurants)
      .set(kind === "cover" ? { coverUrl: null } : { faviconUrl: null })
      .where(eq(restaurants.id, restaurantId));
    return true;
  });
}

export async function listPromotions(restaurantId: number, slug: string) {
  const rows = await db
    .select({
      id: restaurantAssets.id,
      title: restaurantAssets.title,
      description: restaurantAssets.description,
      sortOrder: restaurantAssets.sortOrder,
      isActive: restaurantAssets.isActive,
    })
    .from(restaurantAssets)
    .where(and(eq(restaurantAssets.restaurantId, restaurantId), eq(restaurantAssets.kind, "promotion")))
    .orderBy(asc(restaurantAssets.sortOrder), asc(restaurantAssets.createdAt));
  return rows.map((row) => ({
    ...row,
    imageUrl: publicAssetUrl(slug, row.id),
  }));
}

export async function listPublicPromotions(restaurantId: number, slug: string) {
  const rows = await db
    .select({
      id: restaurantAssets.id,
      title: restaurantAssets.title,
      description: restaurantAssets.description,
      sortOrder: restaurantAssets.sortOrder,
    })
    .from(restaurantAssets)
    .where(
      and(
        eq(restaurantAssets.restaurantId, restaurantId),
        eq(restaurantAssets.kind, "promotion"),
        eq(restaurantAssets.isActive, true),
      ),
    )
    .orderBy(asc(restaurantAssets.sortOrder), asc(restaurantAssets.createdAt));
  return rows.map((row) => ({ ...row, imageUrl: publicAssetUrl(slug, row.id) }));
}

export async function createPromotion(
  restaurantId: number,
  input: { title: string; description?: string },
  data: Buffer,
  mimeType: string,
) {
  const [nextOrder] = await db
    .select({ value: restaurantAssets.sortOrder })
    .from(restaurantAssets)
    .where(and(eq(restaurantAssets.restaurantId, restaurantId), eq(restaurantAssets.kind, "promotion")))
    .orderBy(desc(restaurantAssets.sortOrder))
    .limit(1);
  const [asset] = await db
    .insert(restaurantAssets)
    .values({
      restaurantId,
      kind: "promotion",
      title: input.title,
      description: input.description ?? null,
      sortOrder: nextOrder ? nextOrder.value + 1 : 0,
      data,
      mimeType,
    })
    .returning({ id: restaurantAssets.id });
  if (!asset) throw new Error("Promotion was not saved");
  return asset;
}

export async function deletePromotion(restaurantId: number, id: number) {
  const [deleted] = await db
    .delete(restaurantAssets)
    .where(
      and(
        eq(restaurantAssets.id, id),
        eq(restaurantAssets.restaurantId, restaurantId),
        eq(restaurantAssets.kind, "promotion"),
      ),
    )
    .returning({ id: restaurantAssets.id });
  return Boolean(deleted);
}
