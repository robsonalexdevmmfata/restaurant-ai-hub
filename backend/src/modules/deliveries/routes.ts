import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/index.js";
import {
  deliveryAssignmentHistory,
  deliveryAssignments,
  orderStatusHistory,
  orders,
  users,
} from "../../db/schema.js";
import { scheduleRestaurantEvent } from "../events/service.js";
import { parseId } from "../../lib/helpers.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";

const deliveryStatusSchema = z.object({ status: z.literal("ENTREGUE") });

export async function deliveryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireJwt(request, reply);
    if (reply.sent) return;

    const { role } = getAuthUser(request);
    if (!["owner", "gerente", "motoboy"].includes(role)) {
      return reply.status(403).send({ error: "Este perfil não tem acesso às entregas" });
    }
  });

  app.get("/me/deliveries", async (request) => {
    const auth = getAuthUser(request);
    const isManager = auth.role === "owner" || auth.role === "gerente";
    const conditions = [
      eq(orders.restaurantId, auth.restaurantId),
      eq(orders.source, "delivery"),
      ne(deliveryAssignments.status, "ENTREGUE"),
    ];
    if (!isManager) {
      conditions.push(or(isNull(deliveryAssignments.driverId), eq(deliveryAssignments.driverId, auth.sub))!);
    }

    return db
      .select({
        order: orders,
        assignment: deliveryAssignments,
        driverName: users.name,
      })
      .from(orders)
      .innerJoin(
        deliveryAssignments,
        and(
          eq(deliveryAssignments.orderId, orders.id),
          eq(deliveryAssignments.restaurantId, auth.restaurantId),
        ),
      )
      .leftJoin(users, eq(users.id, deliveryAssignments.driverId))
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt));
  });

  app.post("/me/deliveries/:orderId/start", async (request, reply) => {
    const auth = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select({ assignment: deliveryAssignments, order: orders })
        .from(deliveryAssignments)
        .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
        .where(
          and(
            eq(deliveryAssignments.orderId, orderId),
            eq(deliveryAssignments.restaurantId, auth.restaurantId),
            eq(orders.source, "delivery"),
          ),
        )
        .limit(1)
        .for("update");
      if (!assignment) return { missing: true as const };

      const current = assignment.assignment;
      if (["CANCELADO", "FINALIZADO"].includes(assignment.order.status)) {
        return { conflict: true as const };
      }
      if (current.status !== "DISPONIVEL") return { conflict: true as const };
      if (
        current.driverId !== null &&
        current.driverId !== auth.sub &&
        auth.role === "motoboy"
      ) {
        return { conflict: true as const };
      }

      const now = new Date();
      const [updated] = await tx
        .update(deliveryAssignments)
        .set({
          driverId: auth.sub,
          status: "EM_ROTA",
          assignedAt: now,
          updatedAt: now,
        })
        .where(eq(deliveryAssignments.orderId, orderId))
        .returning();
      if (!updated) throw new Error("Delivery assignment disappeared while holding its row lock");

      await tx.insert(deliveryAssignmentHistory).values({
        restaurantId: auth.restaurantId,
        orderId,
        driverId: auth.sub,
        status: "EM_ROTA",
      });
      const [updatedOrder] = await tx
        .update(orders)
        .set({ status: "SAIU_PARA_ENTREGA" })
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, auth.restaurantId)))
        .returning();
      if (!updatedOrder) throw new Error("Order disappeared while holding its delivery assignment lock");
      await tx.insert(orderStatusHistory).values({
        restaurantId: auth.restaurantId,
        orderId,
        previousStatus: assignment.order.status,
        newStatus: updatedOrder.status,
        operatorId: auth.sub,
        source: "delivery_api",
      });
      return { assignment: updated, order: updatedOrder, previousStatus: assignment.order.status };
    });

    if ("missing" in result) return reply.status(404).send({ error: "Delivery not found" });
    if ("conflict" in result) {
      return reply.status(409).send({ error: "A entrega já foi atribuída ou atualizada por outro operador" });
    }
    scheduleRestaurantEvent(
      auth.restaurantId,
      "ORDER_STATUS_CHANGED",
      {
        orderId: result.order.id,
        previousStatus: result.previousStatus,
        newStatus: result.order.status,
        customerName: result.order.customerName,
        customerPhone: result.order.customerPhone,
        source: result.order.source,
        total: result.order.total,
      },
      request.log,
    );
    return result.assignment;
  });

  app.get("/me/deliveries/history", async (request) => {
    const auth = getAuthUser(request);
    const isManager = auth.role === "owner" || auth.role === "gerente";
    const conditions = [
      eq(deliveryAssignments.restaurantId, auth.restaurantId),
      eq(deliveryAssignments.status, "ENTREGUE"),
    ];
    if (!isManager) conditions.push(eq(deliveryAssignments.driverId, auth.sub));

    return db
      .select({
        orderId: orders.id,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        deliveryAddress: orders.deliveryAddress,
        deliveryNeighborhood: orders.deliveryNeighborhood,
        orderDetails: orders.orderDetails,
        total: orders.total,
        driverId: deliveryAssignments.driverId,
        driverName: users.name,
        deliveredAt: deliveryAssignments.deliveredAt,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
      .leftJoin(users, eq(users.id, deliveryAssignments.driverId))
      .where(and(...conditions))
      .orderBy(desc(deliveryAssignments.deliveredAt))
      .limit(100);
  });

  app.patch("/me/deliveries/:orderId/status", async (request, reply) => {
    const auth = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const parsed = deliveryStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid delivery status" });
    }

    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select({ assignment: deliveryAssignments, order: orders })
        .from(deliveryAssignments)
        .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
        .where(
          and(
            eq(deliveryAssignments.orderId, orderId),
            eq(deliveryAssignments.restaurantId, auth.restaurantId),
            eq(orders.source, "delivery"),
          ),
        )
        .limit(1)
        .for("update");
      if (!assignment) return { missing: true as const };

      const current = assignment.assignment;
      if (["CANCELADO", "FINALIZADO"].includes(assignment.order.status)) {
        return { conflict: true as const };
      }
      if (
        current.status !== "EM_ROTA" ||
        (auth.role === "motoboy" && current.driverId !== auth.sub)
      ) {
        return { conflict: true as const };
      }

      const now = new Date();
      const [updated] = await tx
        .update(deliveryAssignments)
        .set({ status: "ENTREGUE", deliveredAt: now, updatedAt: now })
        .where(eq(deliveryAssignments.orderId, orderId))
        .returning();
      if (!updated) throw new Error("Delivery assignment disappeared while holding its row lock");

      await tx.insert(deliveryAssignmentHistory).values({
        restaurantId: auth.restaurantId,
        orderId,
        driverId: current.driverId,
        status: "ENTREGUE",
      });
      const [updatedOrder] = await tx
        .update(orders)
        .set({ status: "FINALIZADO" })
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, auth.restaurantId)))
        .returning();
      if (!updatedOrder) throw new Error("Order disappeared while holding its delivery assignment lock");
      await tx.insert(orderStatusHistory).values({
        restaurantId: auth.restaurantId,
        orderId,
        previousStatus: assignment.order.status,
        newStatus: updatedOrder.status,
        operatorId: auth.sub,
        source: "delivery_api",
      });
      return { assignment: updated, order: updatedOrder, previousStatus: assignment.order.status };
    });

    if ("missing" in result) return reply.status(404).send({ error: "Delivery not found" });
    if ("conflict" in result) {
      return reply.status(409).send({ error: "A entrega não está atribuída a você ou já foi atualizada" });
    }
    scheduleRestaurantEvent(
      auth.restaurantId,
      "ORDER_STATUS_CHANGED",
      {
        orderId: result.order.id,
        previousStatus: result.previousStatus,
        newStatus: result.order.status,
        customerName: result.order.customerName,
        customerPhone: result.order.customerPhone,
        source: result.order.source,
        total: result.order.total,
      },
      request.log,
    );
    return result.assignment;
  });

  app.get("/me/deliveries/:orderId/history", async (request, reply) => {
    const { restaurantId } = getAuthUser(request);
    const orderId = parseId((request.params as { orderId: string }).orderId);
    if (!orderId) return reply.status(400).send({ error: "Invalid order id" });

    const [delivery] = await db
      .select({ orderId: deliveryAssignments.orderId })
      .from(deliveryAssignments)
      .where(
        and(
          eq(deliveryAssignments.orderId, orderId),
          eq(deliveryAssignments.restaurantId, restaurantId),
        ),
      )
      .limit(1);
    if (!delivery) return reply.status(404).send({ error: "Delivery not found" });

    return db
      .select({
        driverId: deliveryAssignmentHistory.driverId,
        driverName: users.name,
        status: deliveryAssignmentHistory.status,
        occurredAt: deliveryAssignmentHistory.occurredAt,
      })
      .from(deliveryAssignmentHistory)
      .leftJoin(users, eq(users.id, deliveryAssignmentHistory.driverId))
      .where(
        and(
          eq(deliveryAssignmentHistory.orderId, orderId),
          eq(deliveryAssignmentHistory.restaurantId, restaurantId),
        ),
      )
      .orderBy(desc(deliveryAssignmentHistory.occurredAt), desc(deliveryAssignmentHistory.id));
  });
}
