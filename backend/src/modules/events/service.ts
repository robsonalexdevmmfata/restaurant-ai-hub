import type { FastifyBaseLogger } from "fastify";
import { eq } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { restaurants } from "../../db/schema.js";

export type RestaurantEventName =
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGED"
  | "TABLE_CLOSE_REQUESTED";

function statusMessage(status: string) {
  const labels: Record<string, string> = {
    PENDENTE: "recebido pelo restaurante",
    PREPARANDO: "em preparo",
    ENTREGUE: "pronto",
    SAIU_PARA_ENTREGA: "saiu para entrega",
    FINALIZADO: "finalizado",
    CANCELADO: "cancelado",
  };
  return labels[status] ?? status.toLocaleLowerCase("pt-BR");
}

function notifyCustomer(
  event: RestaurantEventName,
  data: Record<string, unknown>,
): { phone: string; message: string } | null {
  const phone = typeof data.customerPhone === "string" ? data.customerPhone.replace(/\D/g, "") : "";
  if (!phone) return null;

  const orderId = typeof data.orderId === "number" ? ` #${data.orderId}` : "";
  if (event === "ORDER_CREATED") {
    return { phone, message: `Recebemos seu pedido${orderId}. A cozinha já foi avisada.` };
  }
  if (event === "ORDER_STATUS_CHANGED" && typeof data.newStatus === "string") {
    return { phone, message: `Atualização do pedido${orderId}: ${statusMessage(data.newStatus)}.` };
  }
  return null;
}

async function sendWebhook(url: string, payload: Record<string, unknown>, logger: FastifyBaseLogger) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      logger.warn({ statusCode: response.status, event: payload.event }, "Restaurant webhook returned an error");
    }
  } catch (error) {
    logger.error(
      { event: payload.event, errorName: error instanceof Error ? error.name : "unknown" },
      "Restaurant webhook delivery failed",
    );
  }
}

async function sendEvolutionMessage(
  instance: string,
  message: { phone: string; message: string } | null,
  logger: FastifyBaseLogger,
) {
  if (!message || !env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) return;
  try {
    const response = await fetch(
      `${env.EVOLUTION_API_URL.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: message.phone,
          text: message.message,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      logger.warn({ statusCode: response.status, instance }, "Evolution API returned an error");
    }
  } catch (error) {
    logger.error(
      { instance, errorName: error instanceof Error ? error.name : "unknown" },
      "Evolution API message delivery failed",
    );
  }
}

export async function dispatchRestaurantEvent(
  restaurantId: number,
  event: RestaurantEventName,
  data: Record<string, unknown>,
  logger: FastifyBaseLogger,
) {
  const [restaurant] = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      webhookUrl: restaurants.webhookUrl,
      whatsappInstance: restaurants.whatsappInstance,
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  if (!restaurant) return;

  const payload = {
    event,
    occurredAt: new Date().toISOString(),
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    data,
  };
  await Promise.all([
    restaurant.webhookUrl ? sendWebhook(restaurant.webhookUrl, payload, logger) : Promise.resolve(),
    sendEvolutionMessage(
      restaurant.whatsappInstance,
      notifyCustomer(event, data),
      logger,
    ),
  ]);
}

export function scheduleRestaurantEvent(
  restaurantId: number,
  event: RestaurantEventName,
  data: Record<string, unknown>,
  logger: FastifyBaseLogger,
) {
  void dispatchRestaurantEvent(restaurantId, event, data, logger).catch((error: unknown) => {
    logger.error({ err: error, event, restaurantId }, "Restaurant event dispatch failed");
  });
}
