import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { orders, restaurantTables, tableSessions } from "../../db/schema.js";
import type { CloseSessionInput, CreateTableInput, UpdateTableInput } from "./schemas.js";

/** Mesas do restaurante já com a sessão aberta (se houver) e o consumo acumulado. */
export async function listTables(restaurantId: number) {
  const rows = await db
    .select({
      id: restaurantTables.id,
      restaurantId: restaurantTables.restaurantId,
      label: restaurantTables.label,
      seats: restaurantTables.seats,
      isActive: restaurantTables.isActive,
      createdAt: restaurantTables.createdAt,
      sessionId: tableSessions.id,
      sessionOpenedAt: tableSessions.openedAt,
    })
    .from(restaurantTables)
    .leftJoin(
      tableSessions,
      and(eq(tableSessions.tableId, restaurantTables.id), eq(tableSessions.status, "ABERTA")),
    )
    .where(eq(restaurantTables.restaurantId, restaurantId))
    .orderBy(asc(restaurantTables.label));

  const totals = await db
    .select({
      sessionId: orders.sessionId,
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))
    .groupBy(orders.sessionId);

  const bySession = new Map(totals.map((t) => [t.sessionId, t]));

  return rows.map((row) => ({
    ...row,
    sessionTotal: row.sessionId ? Number(bySession.get(row.sessionId)?.total ?? 0) : 0,
    sessionOrders: row.sessionId ? (bySession.get(row.sessionId)?.orderCount ?? 0) : 0,
  }));
}

export async function getTable(id: number, restaurantId: number) {
  const [row] = await db
    .select()
    .from(restaurantTables)
    .where(and(eq(restaurantTables.id, id), eq(restaurantTables.restaurantId, restaurantId)))
    .limit(1);
  return row ?? null;
}

export async function getTableByLabel(restaurantId: number, label: string) {
  const [row] = await db
    .select()
    .from(restaurantTables)
    .where(and(eq(restaurantTables.restaurantId, restaurantId), eq(restaurantTables.label, label)))
    .limit(1);
  return row ?? null;
}

export async function createTable(restaurantId: number, input: CreateTableInput) {
  const [row] = await db
    .insert(restaurantTables)
    .values({
      restaurantId,
      label: input.label,
      seats: input.seats,
      isActive: input.isActive,
    })
    .returning();
  return row;
}

export async function updateTable(id: number, restaurantId: number, input: UpdateTableInput) {
  const [row] = await db
    .update(restaurantTables)
    .set({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.seats !== undefined && { seats: input.seats }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    })
    .where(and(eq(restaurantTables.id, id), eq(restaurantTables.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}

export async function deleteTable(id: number, restaurantId: number) {
  const [row] = await db
    .delete(restaurantTables)
    .where(and(eq(restaurantTables.id, id), eq(restaurantTables.restaurantId, restaurantId)))
    .returning({ id: restaurantTables.id });
  return Boolean(row);
}

/* ---------- Sessões (abertura/fechamento de mesa) ---------- */

export async function getOpenSession(tableId: number, restaurantId: number) {
  const [row] = await db
    .select()
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.tableId, tableId),
        eq(tableSessions.restaurantId, restaurantId),
        eq(tableSessions.status, "ABERTA"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function ensureOpenSession(tableId: number, restaurantId: number) {
  const existing = await getOpenSession(tableId, restaurantId);
  if (existing) return existing;

  const [row] = await db
    .insert(tableSessions)
    .values({ restaurantId, tableId, status: "ABERTA" })
    .returning();
  return row;
}

/** Consumo detalhado de uma sessão, usado pelo caixa. */
export async function getSessionBill(sessionId: number, restaurantId: number) {
  const [session] = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.id, sessionId), eq(tableSessions.restaurantId, restaurantId)))
    .limit(1);
  if (!session) return null;

  const sessionOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.sessionId, sessionId), eq(orders.restaurantId, restaurantId)))
    .orderBy(desc(orders.createdAt));

  const total = sessionOrders.reduce((sum, order) => sum + Number(order.total), 0);
  return { session, orders: sessionOrders, total };
}

export async function closeSession(
  sessionId: number,
  restaurantId: number,
  input: CloseSessionInput,
) {
  const bill = await getSessionBill(sessionId, restaurantId);
  if (!bill) return null;

  const [row] = await db
    .update(tableSessions)
    .set({
      status: "FECHADA",
      paymentMethod: input.paymentMethod,
      total: bill.total.toFixed(2),
      closedAt: new Date(),
    })
    .where(and(eq(tableSessions.id, sessionId), eq(tableSessions.restaurantId, restaurantId)))
    .returning();
  return row ?? null;
}

/** Mesas abertas com consumo — tela do Caixa. */
export async function listOpenSessions(restaurantId: number) {
  const rows = await db
    .select({
      sessionId: tableSessions.id,
      openedAt: tableSessions.openedAt,
      tableId: restaurantTables.id,
      tableLabel: restaurantTables.label,
    })
    .from(tableSessions)
    .innerJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
    .where(and(eq(tableSessions.restaurantId, restaurantId), eq(tableSessions.status, "ABERTA")))
    .orderBy(asc(restaurantTables.label));

  return Promise.all(
    rows.map(async (row) => {
      const bill = await getSessionBill(row.sessionId, restaurantId);
      return { ...row, total: bill?.total ?? 0, orders: bill?.orders ?? [] };
    }),
  );
}
