import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { diningTables } from "../../db/schema.js";
import * as restaurantService from "../restaurants/service.js";

const TABLE_COUNT = 12;

export async function listPublicTables(slug: string) {
  const restaurant = await restaurantService.getRestaurantBySlug(slug);
  if (!restaurant) return null;
  const rows = await db.select().from(diningTables).where(eq(diningTables.restaurantId, restaurant.id));
  const byNumber = new Map(rows.map((table) => [table.tableNumber, table]));
  const tables = Array.from({ length: TABLE_COUNT }, (_, index) => {
    const tableNumber = index + 1;
    const table = byNumber.get(tableNumber);
    return table ?? { id: null, restaurantId: restaurant.id, tableNumber, status: "Livre", sessionId: null, openedAt: null, updatedAt: null };
  });
  return { restaurantName: restaurant.name, tables };
}

export async function openPublicTable(slug: string, tableNumber: number) {
  const restaurant = await restaurantService.getRestaurantBySlug(slug);
  if (!restaurant) return null;

  const [existing] = await db.select().from(diningTables).where(and(
    eq(diningTables.restaurantId, restaurant.id),
    eq(diningTables.tableNumber, tableNumber),
  )).limit(1);
  if (existing?.status === "Ocupada" && existing.sessionId) return existing;

  const sessionId = randomUUID();
  const openedAt = new Date();
  if (existing) {
    const [updated] = await db.update(diningTables)
      .set({ status: "Ocupada", sessionId, openedAt, updatedAt: openedAt })
      .where(eq(diningTables.id, existing.id))
      .returning();
    return updated ?? null;
  }

  const [created] = await db.insert(diningTables).values({
    restaurantId: restaurant.id,
    tableNumber,
    status: "Ocupada",
    sessionId,
    openedAt,
    updatedAt: openedAt,
  }).onConflictDoNothing().returning();
  if (created) return created;

  const [raced] = await db.select().from(diningTables).where(and(
    eq(diningTables.restaurantId, restaurant.id),
    eq(diningTables.tableNumber, tableNumber),
  )).limit(1);
  return raced ?? null;
}

export async function closePublicTable(slug: string, tableNumber: number, sessionId: string) {
  const restaurant = await restaurantService.getRestaurantBySlug(slug);
  if (!restaurant) return null;
  const [closed] = await db.update(diningTables)
    .set({ status: "Livre", sessionId: null, openedAt: null, updatedAt: new Date() })
    .where(and(
      eq(diningTables.restaurantId, restaurant.id),
      eq(diningTables.tableNumber, tableNumber),
      eq(diningTables.sessionId, sessionId),
    ))
    .returning();
  return closed ?? null;
}
