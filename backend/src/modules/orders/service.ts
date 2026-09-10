import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { conversations, orders } from "../../db/schema.js";
import type { ListOrdersQuery, UpdateOrderStatusInput } from "./schemas.js";

export async function listOrdersByRestaurant(restaurantId: number, query: ListOrdersQuery) {
  const conditions = [eq(orders.restaurantId, restaurantId)];
  if (query.status) {
    conditions.push(eq(orders.status, query.status));
  }

  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(query.limit);
}

export async function listOrdersSince(restaurantId: number, sinceId: number, limit = 50) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.restaurantId, restaurantId), gt(orders.id, sinceId)))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function createOrder(input: {
  restaurantId: number;
  customerPhone: string;
  orderDetails: string;
  status?: string;
}) {
  const [row] = await db
    .insert(orders)
    .values({
      restaurantId: input.restaurantId,
      customerPhone: input.customerPhone,
      orderDetails: input.orderDetails,
      status: input.status ?? "PENDENTE",
    })
    .returning();
  return row;
}

export async function updateOrderStatus(
  orderId: number,
  restaurantId: number,
  input: UpdateOrderStatusInput,
) {
  const [row] = await db
    .update(orders)
    .set({ status: input.status })
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}

export async function getDashboardStats(restaurantId: number) {
  const today = sql`date_trunc('day', now())`;

  const [orderStats] = await db
    .select({
      totalToday: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${orders.status} = 'PENDENTE')::int`,
    })
    .from(orders)
    .where(and(eq(orders.restaurantId, restaurantId), sql`${orders.createdAt} >= ${today}`));

  const [conversationStats] = await db
    .select({
      openChats: sql<number>`count(*)::int`,
      aiActive: sql<number>`count(*) filter (where ${conversations.mode} = 'ia')::int`,
    })
    .from(conversations)
    .where(eq(conversations.restaurantId, restaurantId));

  return {
    ordersToday: orderStats?.totalToday ?? 0,
    pendingOrders: orderStats?.pending ?? 0,
    openConversations: conversationStats?.openChats ?? 0,
    aiActiveConversations: conversationStats?.aiActive ?? 0,
  };
}
