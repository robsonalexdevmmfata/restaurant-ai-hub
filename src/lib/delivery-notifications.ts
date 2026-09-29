import { updateTenantOperations, type OperationalOrder } from "@/lib/operations";

export type DeliveryNotificationResult = "sent" | "simulated" | "failed" | "missing-phone";
export type DeliveryNotificationEvent = "PREPARING" | "READY" | "OUT_FOR_DELIVERY";

function formatCustomerMessage(
  order: OperationalOrder,
  event: DeliveryNotificationEvent,
  driverName?: string,
  eta = order.eta,
) {
  const orderLabel = `#${order.id}`;
  if (event === "PREPARING") return `Olá, ${order.customer}! Seu pedido ${orderLabel} está sendo preparado.`;
  if (event === "READY") return `Olá, ${order.customer}! Seu pedido ${orderLabel} está pronto.`;
  return `Olá, ${order.customer}! Seu pedido ${orderLabel} saiu para entrega${driverName ? ` com o motoboy ${driverName}` : ""}. Previsão de chegada: ${eta}.`;
}

export async function notifyCustomerOrderStatus(
  order: OperationalOrder,
  event: DeliveryNotificationEvent,
  driverName?: string,
  eta = order.eta,
): Promise<{ status: DeliveryNotificationResult; message: string }> {
  const message = formatCustomerMessage(order, event, driverName, eta);
  const phone = order.customerPhone?.replace(/\s/g, "") ?? "";
  if (phone.length < 8) return { status: "missing-phone", message };

  const proxyUrl = import.meta.env.VITE_EVOLUTION_NOTIFICATION_PROXY_URL;
  if (!proxyUrl) return { status: "simulated", message };

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerPhone: phone,
        orderId: order.id,
        event,
        message,
      }),
    });
    return { status: response.ok ? "sent" : "failed", message };
  } catch {
    return { status: "failed", message };
  }
}

export async function dispatchOrderStatusNotification(
  restaurantSlug: string,
  order: OperationalOrder,
  event: DeliveryNotificationEvent,
  driverName?: string,
  eta = order.eta,
) {
  const result = await notifyCustomerOrderStatus(order, event, driverName, eta);
  updateTenantOperations(restaurantSlug, (current) => ({
    ...current,
    notifications: [
      {
        id: `whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        phone: order.customerPhone ?? "",
        status: result.status,
        message: result.message,
        createdAt: new Date().toISOString(),
      },
      ...current.notifications,
    ],
  }));
  return result;
}

export async function dispatchAbandonedCartCouponReminder(
  restaurantSlug: string,
  customerPhone: string,
  customerName: string,
  couponCode: string,
  cartTotal: number,
) {
  const phone = customerPhone.replace(/\s/g, "");
  const message = `Olá${customerName ? `, ${customerName}` : ""}! Seu pedido ficou no carrinho. Use o cupom ${couponCode} para concluir. Total atual: R$ ${cartTotal.toFixed(2).replace(".", ",")}.`;
  let status: "sent" | "simulated" | "failed" | "missing-phone" = "simulated";
  if (phone.length < 8) status = "missing-phone";
  else {
    const proxyUrl = import.meta.env.VITE_EVOLUTION_NOTIFICATION_PROXY_URL;
    if (proxyUrl) {
      try {
        const response = await fetch(proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerPhone: phone, event: "CART_ABANDONED", message, restaurantSlug, couponCode }),
        });
        status = response.ok ? "sent" : "failed";
      } catch {
        status = "failed";
      }
    }
  }

  updateTenantOperations(restaurantSlug, (current) => ({
    ...current,
    notifications: [{
      id: `whatsapp-cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: `cart-${restaurantSlug}`,
      phone,
      status,
      message,
      createdAt: new Date().toISOString(),
    }, ...current.notifications],
  }));
  return { status, message };
}
