import { and, desc, eq, lte, or, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { conversationMessages, conversations } from "../../db/schema.js";
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

export async function listRecentMessages(
  conversationId: number,
  throughMessageId: number,
  limit = 12,
) {
  const rows = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        lte(conversationMessages.id, throughMessageId),
        or(
          eq(conversationMessages.role, "user"),
          eq(conversationMessages.deliveryStatus, "sent"),
        ),
      ),
    )
    .orderBy(desc(conversationMessages.id))
    .limit(limit);
  return rows.reverse();
}

export async function getInboundMessage(conversationId: number, externalMessageId: string) {
  const [row] = await db
    .select()
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.externalMessageId, externalMessageId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getReplyForInbound(conversationId: number, inboundMessageId: number) {
  const [row] = await db
    .select()
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.replyToMessageId, inboundMessageId),
        eq(conversationMessages.role, "assistant"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createInboundMessage(
  conversationId: number,
  content: string,
  externalMessageId: string | null,
) {
  const [row] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      role: "user",
      content,
      externalMessageId,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function createPendingAssistantMessage(
  conversationId: number,
  inboundMessageId: number,
  content: string,
) {
  const [row] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      role: "assistant",
      content,
      replyToMessageId: inboundMessageId,
      deliveryStatus: "pending",
    })
    .onConflictDoNothing()
    .returning();
  return row ?? getReplyForInbound(conversationId, inboundMessageId);
}

export async function claimMessageDelivery(id: number) {
  const [row] = await db
    .update(conversationMessages)
    .set({ deliveryStatus: "sending", deliveryAttemptedAt: sql`now()` })
    .where(
      and(
        eq(conversationMessages.id, id),
        sql`(
          ${conversationMessages.deliveryStatus} = 'pending'
          OR (
            ${conversationMessages.deliveryStatus} = 'sending'
            AND (
              ${conversationMessages.deliveryAttemptedAt} IS NULL
              OR ${conversationMessages.deliveryAttemptedAt} < now() - interval '1 minute'
            )
          )
        )`,
      ),
    )
    .returning({ id: conversationMessages.id });
  return Boolean(row);
}

export async function markMessagePending(id: number) {
  await db
    .update(conversationMessages)
    .set({ deliveryStatus: "pending" })
    .where(and(eq(conversationMessages.id, id), eq(conversationMessages.deliveryStatus, "sending")));
}

export async function markMessageDelivered(id: number) {
  await db
    .update(conversationMessages)
    .set({ deliveryStatus: "sent" })
    .where(and(eq(conversationMessages.id, id), eq(conversationMessages.deliveryStatus, "sending")));
}
