import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { restaurants } from "../../db/schema.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";
import * as conversationService from "../conversations/service.js";
import * as restaurantService from "../restaurants/service.js";

const evolutionWebhookSchema = z.record(z.string(), z.unknown());
const createInstanceSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
});

type ChatMessage = { role: "user" | "assistant"; content: string };

function getRestaurantWebhookToken(restaurantId: number) {
  if (!env.EVOLUTION_WEBHOOK_TOKEN) return null;
  return createHmac("sha256", env.EVOLUTION_WEBHOOK_TOKEN)
    .update(`restaurant:${restaurantId}`)
    .digest("hex");
}

function matchesRestaurantWebhookToken(restaurantId: number, token: string) {
  const expected = getRestaurantWebhookToken(restaurantId);
  if (!expected || !/^[a-f0-9]{64}$/i.test(token)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}

function getInstanceName(restaurantName: string, restaurantId: number) {
  const normalized = restaurantName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255)
    .replace(/-+$/g, "");
  return normalized || `restaurante-${restaurantId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readQrCode(payload: unknown) {
  const response = asRecord(payload);
  const qr = asRecord(response?.qrcode) ?? response;
  const qrBase64 = typeof qr?.base64 === "string" ? qr.base64 : null;
  return qrBase64?.startsWith("data:image/")
    ? qrBase64
    : qrBase64
      ? `data:image/png;base64,${qrBase64}`
      : null;
}

function readText(message: Record<string, unknown>) {
  for (const key of ["conversation", "text"]) {
    if (typeof message[key] === "string") return message[key].trim();
  }
  for (const key of ["extendedTextMessage", "imageMessage", "videoMessage", "documentMessage"]) {
    const nested = asRecord(message[key]);
    if (typeof nested?.text === "string") return nested.text.trim();
    if (typeof nested?.caption === "string") return nested.caption.trim();
  }
  return "";
}

function getResponseText(payload: unknown): string {
  const response = asRecord(payload);
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  if (!Array.isArray(response?.output)) return "";

  return response.output
    .flatMap((item) => {
      const outputItem = asRecord(item);
      return Array.isArray(outputItem?.content) ? outputItem.content : [];
    })
    .map((item) => asRecord(item)?.text)
    .filter((text): text is string => typeof text === "string")
    .join("\n")
    .trim();
}

function getInstructions(
  restaurant: NonNullable<Awaited<ReturnType<typeof restaurantService.getTenantContext>>>,
) {
  const menu = restaurant.products
    .filter((product) => product.status === "DISPONIVEL")
    .map((product) => ({
      name: product.name,
      category: product.category,
      description: product.description,
      price: Number(product.price),
    }));
  const publicMenuUrl = env.PUBLIC_APP_URL
    ? `${env.PUBLIC_APP_URL.replace(/\/+$/, "")}/r/${encodeURIComponent(restaurant.restaurant.slug)}`
    : "";

  return [
    `Você é o atendente virtual de ${restaurant.restaurant.name}, falando pelo WhatsApp.`,
    "Responda em português do Brasil, de forma simpática, breve e clara.",
    "Use somente os dados do restaurante e do cardápio abaixo. Não invente produtos, preços, ingredientes, horários, disponibilidade ou políticas.",
    "Se faltar uma informação, diga que vai pedir ajuda à equipe. Nunca afirme que um pedido foi registrado, pago ou enviado à cozinha: este canal apenas tira dúvidas e encaminha o cliente ao cardápio online para finalizar o pedido.",
    restaurant.restaurant.description
      ? `Sobre o restaurante: ${restaurant.restaurant.description}`
      : "",
    restaurant.restaurant.openingHours ? `Horário: ${restaurant.restaurant.openingHours}` : "",
    restaurant.restaurant.address ? `Endereço: ${restaurant.restaurant.address}` : "",
    restaurant.aiInstructions ? `Orientações do proprietário:\n${restaurant.aiInstructions}` : "",
    `Cardápio disponível (preços em reais): ${JSON.stringify(menu)}`,
    publicMenuUrl ? `Link seguro para consultar e finalizar pedidos: ${publicMenuUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateReply(
  messages: ChatMessage[],
  instructions: string,
  logger: FastifyInstance["log"],
) {
  if (!env.GROK_API_KEY) throw new Error("GROK_API_KEY não está configurada.");
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROK_MODEL,
      instructions,
      input: messages,
      store: false,
      max_output_tokens: 500,
      temperature: 0.3,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    logger.error({ statusCode: response.status }, "Grok API request failed");
    throw new Error("O agente de IA está indisponível no momento.");
  }
  const payload: unknown = await response.json();
  const text = getResponseText(payload);
  if (!text) throw new Error("O agente de IA retornou uma resposta vazia.");
  return text;
}

async function sendWhatsAppMessage(instance: string, phone: string, text: string) {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
    throw new Error("EVOLUTION_API_URL e EVOLUTION_API_KEY não estão configuradas.");
  }
  const response = await fetch(
    `${env.EVOLUTION_API_URL.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phone, text }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`A Evolution API recusou o envio (HTTP ${response.status}).`);
  }
}

async function deliverPendingReply(
  instance: string,
  phone: string,
  message: Awaited<ReturnType<typeof conversationService.createPendingAssistantMessage>>,
) {
  if (!message) return;
  const claimed = await conversationService.claimMessageDelivery(message.id);
  if (!claimed) return;
  try {
    await sendWhatsAppMessage(instance, phone, message.content);
    await conversationService.markMessageDelivered(message.id);
  } catch (error) {
    await conversationService.markMessagePending(message.id);
    throw error;
  }
}

export async function aiRoutes(app: FastifyInstance) {
  app.get("/me/ai/status", { preHandler: requireJwt }, async (request, reply) => {
    const auth = getAuthUser(request);
    if (auth.role !== "owner") {
      return reply
        .status(403)
        .send({ error: "Only the restaurant owner can view AI integration settings." });
    }
    const { restaurantId } = auth;
    const [restaurant] = await db
      .select({
        whatsappInstance: restaurants.whatsappInstance,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    let evolutionConnectionState = "not_configured";
    if (env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY) {
      try {
        const response = await fetch(
          `${env.EVOLUTION_API_URL.replace(/\/+$/, "")}/instance/connectionState/${encodeURIComponent(restaurant.whatsappInstance)}`,
          {
            headers: { apikey: env.EVOLUTION_API_KEY },
            redirect: "error",
            signal: AbortSignal.timeout(4_000),
          },
        );
        if (!response.ok) {
          evolutionConnectionState = response.status === 401 ? "unauthorized" : "unreachable";
          request.log.warn(
            { statusCode: response.status, restaurantId },
            "Could not read Evolution instance connection state",
          );
        } else {
          const statePayload = asRecord(await response.json());
          const instanceState = asRecord(statePayload?.instance)?.state;
          evolutionConnectionState =
            typeof instanceState === "string" && instanceState ? instanceState : "unknown";
        }
      } catch (error) {
        evolutionConnectionState = "unreachable";
        request.log.warn(
          { errorName: error instanceof Error ? error.name : "unknown", restaurantId },
          "Evolution API connection-state check failed",
        );
      }
    }

    return {
      evolutionConnectionState,
      evolutionInstanceConnected: evolutionConnectionState === "open",
    };
  });

  app.post("/me/ai/instance", { preHandler: requireJwt }, async (request, reply) => {
    const auth = getAuthUser(request);
    if (auth.role !== "owner") {
      return reply
        .status(403)
        .send({ error: "Only the restaurant owner can create an Evolution instance." });
    }
    if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
      return reply
        .status(503)
        .send({ error: "A conexão do WhatsApp está temporariamente indisponível." });
    }

    const parsed = createInstanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Informe um nome de restaurante válido." });
    }

    const [restaurant] = await db
      .select({
        id: restaurants.id,
        whatsappInstance: restaurants.whatsappInstance,
      })
      .from(restaurants)
      .where(eq(restaurants.id, auth.restaurantId))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found." });

    const instanceName = getInstanceName(parsed.data.restaurantName, restaurant.id);
    const [otherOwner] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.whatsappInstance, instanceName))
      .limit(1);
    if (otherOwner && otherOwner.id !== restaurant.id) {
      return reply
        .status(409)
        .send({ error: "Esse nome já está em uso por outro restaurante. Escolha outro nome." });
    }

    const apiUrl = env.EVOLUTION_API_URL.replace(/\/+$/, "");
    let qrCode: string | null = null;
    let state = "connecting";
    let created = false;
    const webhookUrl =
      env.N8N_EVOLUTION_WEBHOOK_URL ??
      (env.GROK_API_KEY && env.EVOLUTION_WEBHOOK_TOKEN && env.PUBLIC_API_URL
        ? `${env.PUBLIC_API_URL.replace(/\/+$/, "")}/api/webhooks/evolution/${restaurant.id}/${getRestaurantWebhookToken(restaurant.id)}`
        : null);

    const instanceResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: env.EVOLUTION_API_KEY },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!instanceResponse.ok) {
      request.log.error(
        { statusCode: instanceResponse.status, restaurantId: restaurant.id },
        "Could not list Evolution instances",
      );
      return reply
        .status(502)
        .send({ error: "Não foi possível verificar a conexão do WhatsApp. Tente novamente." });
    }

    const instancesPayload: unknown = await instanceResponse.json();
    const existingInstance = Array.isArray(instancesPayload)
      ? instancesPayload.find((item) => asRecord(item)?.name === instanceName)
      : null;

    if (existingInstance) {
      if (restaurant.whatsappInstance !== instanceName) {
        return reply.status(409).send({
          error:
            "Já existe uma instância com esse nome. Informe outro nome ou peça ajuda ao suporte.",
        });
      }

      const stateResponse = await fetch(
        `${apiUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        {
          headers: { apikey: env.EVOLUTION_API_KEY },
          redirect: "error",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!stateResponse.ok) {
        request.log.error(
          { statusCode: stateResponse.status, restaurantId: restaurant.id },
          "Could not read existing Evolution instance state",
        );
        return reply
          .status(502)
          .send({ error: "Não foi possível consultar o estado do WhatsApp." });
      }
      const statePayload = asRecord(await stateResponse.json());
      const instanceState = asRecord(statePayload?.instance)?.state;
      state = typeof instanceState === "string" && instanceState ? instanceState : "unknown";

      if (state !== "open") {
        const connectResponse = await fetch(
          `${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
          {
            headers: { apikey: env.EVOLUTION_API_KEY },
            redirect: "error",
            signal: AbortSignal.timeout(12_000),
          },
        );
        if (!connectResponse.ok) {
          request.log.error(
            { statusCode: connectResponse.status, restaurantId: restaurant.id },
            "Could not start Evolution instance connection",
          );
          return reply
            .status(502)
            .send({ error: "Não foi possível iniciar o pareamento do WhatsApp." });
        }
        const connectPayload: unknown = await connectResponse.json();
        qrCode = readQrCode(connectPayload);
        state = "connecting";
      }

      if (webhookUrl) {
        const webhookResponse = await fetch(
          `${apiUrl}/webhook/set/${encodeURIComponent(instanceName)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: env.EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: true,
                base64: false,
                events: ["MESSAGES_UPSERT"],
              },
            }),
            redirect: "error",
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!webhookResponse.ok) {
          request.log.error(
            { statusCode: webhookResponse.status, restaurantId: restaurant.id },
            "Could not configure Evolution webhook",
          );
          return reply.status(502).send({
            error:
              "A instância foi iniciada, mas não foi possível ativar o atendimento automático.",
          });
        }
      }
    } else {
      const createBody = {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        ...(webhookUrl
          ? {
              webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: true,
                base64: false,
                events: ["MESSAGES_UPSERT"],
              },
            }
          : {}),
      };
      const createResponse = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify(createBody),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const createPayload: unknown = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        request.log.error(
          { statusCode: createResponse.status, restaurantId: restaurant.id },
          "Evolution instance creation failed",
        );
        return reply
          .status(502)
          .send({ error: "Evolution could not create the WhatsApp instance." });
      }
      qrCode = readQrCode(createPayload);
      created = true;

      try {
        await db
          .update(restaurants)
          .set({ whatsappInstance: instanceName })
          .where(eq(restaurants.id, restaurant.id));
      } catch (error) {
        request.log.error(
          { err: error, restaurantId: restaurant.id, instanceName },
          "Evolution instance was created but could not be linked to the restaurant",
        );
        return reply.status(500).send({
          error: "A instância foi criada, mas não foi possível vinculá-la. Tente novamente.",
        });
      }
    }

    if (!qrCode && state !== "open") {
      for (let attempt = 0; attempt < 3 && !qrCode; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 700));
        const connectResponse = await fetch(
          `${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
          {
            headers: { apikey: env.EVOLUTION_API_KEY },
            redirect: "error",
            signal: AbortSignal.timeout(12_000),
          },
        );
        if (!connectResponse.ok) {
          request.log.warn(
            {
              statusCode: connectResponse.status,
              restaurantId: restaurant.id,
              attempt: attempt + 1,
            },
            "Evolution did not return a pairing QR code",
          );
          continue;
        }
        qrCode = readQrCode(await connectResponse.json());
      }
    }

    return {
      instance: instanceName,
      state,
      qrCode,
      created,
      webhookConfigured: Boolean(webhookUrl),
    };
  });

  app.post("/webhooks/evolution/:restaurantId/:token", async (request, reply) => {
    const params = z
      .object({
        restaurantId: z.coerce.number().int().positive(),
        token: z.string().length(64),
      })
      .safeParse(request.params);
    if (
      !params.success ||
      !matchesRestaurantWebhookToken(params.data.restaurantId, params.data.token)
    ) {
      return reply.status(401).send({ error: "Webhook token inválido." });
    }
    if (!env.GROK_API_KEY) {
      return reply
        .status(503)
        .send({ error: "A chave da API Grok não foi configurada no backend." });
    }

    const parsed = evolutionWebhookSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Evento da Evolution inválido." });
    const event = parsed.data;
    const eventName = typeof event.event === "string" ? event.event.toLowerCase() : "";
    if (eventName && !eventName.endsWith("messages.upsert")) {
      return { received: true, ignored: true, reason: "unsupported_event" };
    }

    const data = asRecord(event.data);
    const key = asRecord(data?.key);
    const message = asRecord(data?.message);
    const remoteJid = typeof key?.remoteJid === "string" ? key.remoteJid : "";
    if (
      key?.fromMe === true ||
      !remoteJid ||
      remoteJid.endsWith("@g.us") ||
      remoteJid.endsWith("@broadcast") ||
      !message
    ) {
      return { received: true, ignored: true, reason: "not_a_customer_text_message" };
    }
    const content = readText(message);
    const phone = remoteJid.split("@")[0]?.replace(/\D/g, "") ?? "";
    const instance = typeof event.instance === "string" ? event.instance : "";
    if (!content || !phone || !instance) {
      return { received: true, ignored: true, reason: "message_missing_text_or_instance" };
    }

    const restaurant = await restaurantService.getTenantContext(instance);
    if (!restaurant) {
      request.log.warn(
        { instance },
        "Evolution message received for an unknown restaurant instance",
      );
      return { received: true, ignored: true, reason: "unknown_instance" };
    }
    if (restaurant.restaurant.id !== params.data.restaurantId) {
      return reply.status(401).send({ error: "Webhook token inválido para esta instância." });
    }
    const conversation = await conversationService.upsertConversation(restaurant.restaurant.id, {
      whatsappInstance: instance,
      customerPhone: phone,
    });
    if (!conversation) throw new Error("Conversation could not be created.");
    if (conversation.mode === "humano") {
      return { received: true, ignored: true, reason: "human_handoff" };
    }

    const externalMessageId = typeof key?.id === "string" ? key.id : null;
    let inbound = externalMessageId
      ? await conversationService.getInboundMessage(conversation.id, externalMessageId)
      : null;

    if (inbound) {
      const existingReply = await conversationService.getReplyForInbound(
        conversation.id,
        inbound.id,
      );
      if (existingReply) {
        if (existingReply.deliveryStatus === "pending") {
          await deliverPendingReply(instance, phone, existingReply);
          return { received: true, resent: true };
        }
        return { received: true, duplicate: true };
      }
    } else {
      inbound = await conversationService.createInboundMessage(
        conversation.id,
        content,
        externalMessageId,
      );
      if (!inbound && externalMessageId) {
        inbound = await conversationService.getInboundMessage(conversation.id, externalMessageId);
      }
      if (!inbound) throw new Error("Incoming message could not be stored.");
    }

    try {
      const history: ChatMessage[] = (
        await conversationService.listRecentMessages(conversation.id, inbound.id)
      ).flatMap(({ role, content }) =>
        role === "user" || role === "assistant" ? [{ role, content }] : [],
      );
      const assistantText = await generateReply(history, getInstructions(restaurant), request.log);
      const pendingReply = await conversationService.createPendingAssistantMessage(
        conversation.id,
        inbound.id,
        assistantText,
      );
      await deliverPendingReply(instance, phone, pendingReply);
      return { received: true, replied: true };
    } catch (error) {
      request.log.error(
        { err: error, restaurantId: restaurant.restaurant.id, instance },
        "WhatsApp AI reply failed",
      );
      return reply.status(502).send({
        error: error instanceof Error ? error.message : "Não foi possível responder a mensagem.",
      });
    }
  });
}
