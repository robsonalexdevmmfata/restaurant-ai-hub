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
      closeRequestedAt: tableSessions.closeRequestedAt,
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
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.restaurantId, restaurantId)))
      .for("update")
      .limit(1);
    if (!table) return null;

    const [existing] = await tx
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
    if (existing) return existing;

    const [row] = await tx
      .insert(tableSessions)
      .values({ restaurantId, tableId, status: "ABERTA" })
      .returning();
    return row ?? null;
  });
}

/** Cria uma mesa pública do QR, se ainda não existir, e reaproveita sua comanda aberta. */
export async function ensurePublicTableSession(restaurantId: number, label: string) {
  return db.transaction(async (tx) => {
    let [table] = await tx
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.restaurantId, restaurantId), eq(restaurantTables.label, label)))
      .for("update")
      .limit(1);

    if (!table) {
      [table] = await tx
        .insert(restaurantTables)
        .values({ restaurantId, label, seats: 4, isActive: true })
        .onConflictDoNothing()
        .returning();
      if (!table) {
        [table] = await tx
          .select()
          .from(restaurantTables)
          .where(and(eq(restaurantTables.restaurantId, restaurantId), eq(restaurantTables.label, label)))
          .for("update")
          .limit(1);
      }
    }

    if (!table || !table.isActive) return null;
    const [existing] = await tx
      .select()
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.restaurantId, restaurantId),
          eq(tableSessions.status, "ABERTA"),
        ),
      )
      .limit(1);
    if (existing) return { table, session: existing };

    const [session] = await tx
      .insert(tableSessions)
      .values({ restaurantId, tableId: table.id, status: "ABERTA" })
      .returning();
    return session ? { table, session } : null;
  });
}

/** Dados mínimos para a comanda compartilhada; não expõe telefone nem dados privados. */
export async function getPublicTableSession(restaurantId: number, label: string) {
  const table = await getTableByLabel(restaurantId, label);
  if (!table) return { session: null, orders: [], total: 0 };

  const [session] = await db
    .select()
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.tableId, table.id),
        eq(tableSessions.restaurantId, restaurantId),
        eq(tableSessions.status, "ABERTA"),
      ),
    )
    .limit(1);
  if (!session) return { session: null, orders: [], total: 0 };

  const sessionOrders = await db
    .select({
      id: orders.id,
      itemsJson: orders.itemsJson,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
      paymentMethod: orders.paymentMethod,
    })
    .from(orders)
    .where(and(eq(orders.sessionId, session.id), eq(orders.restaurantId, restaurantId)))
    .orderBy(asc(orders.createdAt));

  return {
    session: {
      id: session.id,
      tableLabel: table.label,
      openedAt: session.openedAt,
      closeRequestedAt: session.closeRequestedAt,
    },
    orders: sessionOrders,
    total: sessionOrders.reduce((sum, order) => sum + Number(order.total), 0),
  };
}

export async function requestTableClosure(restaurantId: number, label: string) {
  const table = await getTableByLabel(restaurantId, label);
  if (!table) return null;

  const [session] = await db
    .update(tableSessions)
    .set({ closeRequestedAt: new Date() })
    .where(
      and(
        eq(tableSessions.tableId, table.id),
        eq(tableSessions.restaurantId, restaurantId),
        eq(tableSessions.status, "ABERTA"),
      ),
    )
    .returning({ id: tableSessions.id });
  if (!session) return null;
  return getPublicTableSession(restaurantId, label);
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
  return db.transaction(async (tx) => {
    const [session] = await tx
    .select()
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.id, sessionId),
        eq(tableSessions.restaurantId, restaurantId),
        eq(tableSessions.status, "ABERTA"),
      ),
    )
    .for("update")
    .limit(1);
    if (!session) return null;

    const sessionOrders = await tx
    .select({ total: orders.total })
    .from(orders)
    .where(and(eq(orders.sessionId, sessionId), eq(orders.restaurantId, restaurantId)));
    const total = sessionOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const [row] = await tx
    .update(tableSessions)
    .set({
      status: "FECHADA",
      paymentMethod: input.paymentMethod,
      total: total.toFixed(2),
      closedAt: new Date(),
      closeRequestedAt: null,
    })
    .where(
      and(
        eq(tableSessions.id, sessionId),
        eq(tableSessions.restaurantId, restaurantId),
        eq(tableSessions.status, "ABERTA"),
      ),
    )
    .returning();
    return row ?? null;
  });
}

/** Mesas abertas com consumo — tela do Caixa. */
export async function listOpenSessions(restaurantId: number) {
  const rows = await db
    .select({
      sessionId: tableSessions.id,
      openedAt: tableSessions.openedAt,
      closeRequestedAt: tableSessions.closeRequestedAt,
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
