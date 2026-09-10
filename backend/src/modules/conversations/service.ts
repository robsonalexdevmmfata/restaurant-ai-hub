import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { conversations } from "../../db/schema.js";
import type {
  UpdateConversationCartInput,
  UpdateConversationModeInput,
  UpsertConversationInput,
} from "./schemas.js";

export async function listConversationsByRestaurant(restaurantId: number) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.restaurantId, restaurantId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number, restaurantId: number) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.restaurantId, restaurantId)))
    .limit(1);
  return row ?? null;
}

export async function upsertConversation(restaurantId: number, input: UpsertConversationInput) {
  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.restaurantId, restaurantId),
        eq(conversations.customerPhone, input.customerPhone),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(conversations)
      .set({
        ...(input.mode !== undefined && { mode: input.mode }),
        ...(input.cartJson !== undefined && { cartJson: input.cartJson }),
        updatedAt: sql`now()`,
      })
      .where(eq(conversations.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(conversations)
    .values({
      restaurantId,
      customerPhone: input.customerPhone,
      mode: input.mode ?? "ia",
      cartJson: input.cartJson ?? null,
    })
    .returning();
  return row;
}

export async function updateConversationMode(
  id: number,
  restaurantId: number,
  input: UpdateConversationModeInput,
) {
  const [row] = await db
    .update(conversations)
    .set({ mode: input.mode, updatedAt: sql`now()` })
    .where(and(eq(conversations.id, id), eq(conversations.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}

export async function updateConversationCart(
  id: number,
  restaurantId: number,
  input: UpdateConversationCartInput,
) {
  const [row] = await db
    .update(conversations)
    .set({ cartJson: input.cartJson, updatedAt: sql`now()` })
    .where(and(eq(conversations.id, id), eq(conversations.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}
