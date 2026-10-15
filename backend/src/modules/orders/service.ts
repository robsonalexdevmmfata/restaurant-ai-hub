import { and, asc, desc, eq, getTableColumns, gt, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  conversations,
  deliveryAssignmentHistory,
  deliveryAssignments,
  orderStatusHistory,
  orders,
  restaurantTables,
  tableSessions,
  users,
} from "../../db/schema.js";
import type { ListOrdersQuery, UpdateOrderStatusInput } from "./schemas.js";

export async function listOrdersByRestaurant(restaurantId: number, query: ListOrdersQuery) {
  const conditions = [eq(orders.restaurantId, restaurantId)];
  if (query.status) {
    conditions.push(eq(orders.status, query.status));
  }

  return db
    .select({
      ...getTableColumns(orders),
      tableLabel: restaurantTables.label,
    })
    .from(orders)
    .leftJoin(restaurantTables, eq(restaurantTables.id, orders.tableId))
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

export async function listOrderStatusHistory(orderId: number, restaurantId: number) {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .limit(1);
  if (!order) return null;

  return db
    .select({
      previousStatus: orderStatusHistory.previousStatus,
      newStatus: orderStatusHistory.newStatus,
      operatorId: orderStatusHistory.operatorId,
      operatorLabel: orderStatusHistory.operatorLabel,
      source: orderStatusHistory.source,
      reason: orderStatusHistory.reason,
      changedAt: orderStatusHistory.changedAt,
    })
    .from(orderStatusHistory)
    .where(
      and(
        eq(orderStatusHistory.orderId, orderId),
        eq(orderStatusHistory.restaurantId, restaurantId),
      ),
    )
    .orderBy(asc(orderStatusHistory.changedAt), asc(orderStatusHistory.id));
}

export async function createOrderWithHistory(input: typeof orders.$inferInsert, source: string) {
  return db.transaction(async (tx) => {
    if (input.sessionId !== null && input.sessionId !== undefined) {
      const [session] = await tx
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.id, input.sessionId),
            eq(tableSessions.restaurantId, input.restaurantId),
            eq(tableSessions.status, "ABERTA"),
          ),
        )
        .for("update")
        .limit(1);
      if (!session) throw new ClosedTableSessionError();
    }

    const [order] = await tx.insert(orders).values(input).returning();
    await tx.insert(orderStatusHistory).values({
      restaurantId: order.restaurantId,
      orderId: order.id,
      previousStatus: null,
      newStatus: order.status,
      source,
      reason: null,
    });
    if (order.source === "delivery") {
      await tx.insert(deliveryAssignments).values({
        orderId: order.id,
        restaurantId: order.restaurantId,
      });
      await tx.insert(deliveryAssignmentHistory).values({
        restaurantId: order.restaurantId,
        orderId: order.id,
        status: "DISPONIVEL",
      });
    }
    return order;
  });
}

export class ClosedTableSessionError extends Error {
  constructor() {
    super("A comanda desta mesa foi encerrada. Atualize a página para abrir uma nova comanda.");
    this.name = "ClosedTableSessionError";
  }
}

export async function createOrder(input: {
  restaurantId: number;
  customerPhone: string;
  orderDetails: string;
  status?: string;
}) {
  return createOrderWithHistory(
    {
      restaurantId: input.restaurantId,
      customerPhone: input.customerPhone,
      orderDetails: input.orderDetails,
      status: input.status ?? "PENDENTE",
    },
    "n8n",
  );
}

export async function updateOrderStatus(
  orderId: number,
  restaurantId: number,
  input: UpdateOrderStatusInput,
  operatorId: number,
  source = "staff_api",
) {
  const validNextStatuses: Record<UpdateOrderStatusInput["status"], string[]> = {
    PENDENTE: [],
    PREPARANDO: ["PENDENTE"],
    ENTREGUE: ["PREPARANDO"],
    SAIU_PARA_ENTREGA: ["PENDENTE", "PREPARANDO", "ENTREGUE"],
    FINALIZADO: ["SAIU_PARA_ENTREGA"],
    CANCELADO: ["PENDENTE", "PREPARANDO"],
  };

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
      .limit(1)
      .for("update");
    if (!current) return null;

    if (current.status === input.status) return { order: current, unchanged: true as const };
    if (!validNextStatuses[input.status].includes(current.status)) {
      return { conflict: true as const, currentStatus: current.status };
    }

    const [operator] = await tx
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, operatorId), eq(users.restaurantId, restaurantId)))
      .limit(1);
    const [updated] = await tx
      .update(orders)
      .set({ status: input.status })
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
      .returning();
    if (!updated) throw new Error("Order status update failed while holding the row lock");

    await tx.insert(orderStatusHistory).values({
      restaurantId,
      orderId,
      previousStatus: current.status,
      newStatus: input.status,
      operatorId,
      operatorLabel: operator?.name ?? operator?.email ?? `Usuário #${operatorId}`,
      source,
      reason: input.reason ?? null,
    });

    return { order: updated, previousStatus: current.status, unchanged: false as const };
  });
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
