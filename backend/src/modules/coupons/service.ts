import { and, asc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { coupons } from "../../db/schema.js";

function serializeCoupon(coupon: typeof coupons.$inferSelect) {
  return {
    ...coupon,
    id: String(coupon.id),
    value: Number(coupon.value),
    startsAt: coupon.startsAt.toISOString(),
    expiresAt: coupon.expiresAt.toISOString(),
    createdAt: coupon.createdAt.toISOString(),
  };
}

export async function listCoupons(restaurantId: number, publicOnly = false) {
  const filters = [eq(coupons.restaurantId, restaurantId)];
  if (publicOnly) filters.push(eq(coupons.active, true));
  const results = await db
    .select()
    .from(coupons)
    .where(and(...filters))
    .orderBy(asc(coupons.createdAt));
  return results.map(serializeCoupon);
}

export async function createCoupon(
  restaurantId: number,
  input: Omit<typeof coupons.$inferInsert, "id" | "restaurantId" | "usedCount" | "active">,
) {
  const [coupon] = await db
    .insert(coupons)
    .values({ ...input, restaurantId })
    .returning();
  return serializeCoupon(coupon);
}

export async function updateCoupon(restaurantId: number, id: number, active: boolean) {
  const [coupon] = await db
    .update(coupons)
    .set({ active })
    .where(and(eq(coupons.id, id), eq(coupons.restaurantId, restaurantId)))
    .returning();
  return coupon ? serializeCoupon(coupon) : null;
}
