import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { useLoad } from "@/components/kit";
import { PrintDevicePanel } from "@/components/print-device-panel";
import { api, type ApiOrderStatusHistory } from "@/lib/api";
import { data } from "@/lib/data";
import { dispatchOrderStatusNotification } from "@/lib/delivery-notifications";
import type { ApiOrder } from "@/lib/api";
import { createStaffActivity, updateTenantOperations, useTenantOperations, type OrderType } from "@/lib/operations";
import { printThermalReceipt, useThermalPaperWidth } from "@/lib/thermal-print";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/cozinha")({
  head: () => ({ meta: [{ title: "Pedidos da cozinha — RestauranteAI" }, { name: "description", content: "RestauranteAI — pedidos da cozinha." }, { property: "og:title", content: "Pedidos da cozinha — RestauranteAI" }, { property: "og:description", content: "RestauranteAI — pedidos da cozinha." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),

  component: KitchenView,
});

function KitchenView() {
  const { tenant, loading } = useRequireTenant("cozinha");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { operations, update } = useTenantOperations(slug);
  const apiOrders = useLoad(() => data.listOrders(), [slug], 5000);
  const { branding } = useTenantBranding(slug);
  const { paperWidth } = useThermalPaperWidth(slug);
  const [orderFilter, setOrderFilter] = useState<"Todos" | OrderType>("Todos");

  useEffect(() => {
    const interval = window.setInterval(() => {
      updateTenantOperations(slug, (current) => ({
        ...current,
        orders: current.orders.map((order) =>
          order.kitchenStatus === "Pronto" ? order : { ...order, waitMinutes: order.waitMinutes + 1 },
        ),
      }));
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [slug]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  function advanceOrder(id: string, nextStatus: "Em preparo" | "Pronto") {
    if (!tenant) return;
    const order = operations.orders.find((item) => item.id === id);
    if (!order) return;
    update((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === id ? { ...order, kitchenStatus: nextStatus } : order,
      ),
      staffAudit: [createStaffActivity(tenant, {
        kind: "order",
        title: nextStatus === "Em preparo" ? `Iniciou preparo ${id}` : `Marcou pedido ${id} como pronto`,
        details: `Pedido alterado para ${nextStatus}.`,
        relatedId: id,
      }), ...current.staffAudit],
    }));
    showToast({
      title: nextStatus === "Em preparo" ? "Preparo iniciado" : "Pedido pronto",
      description: nextStatus === "Em preparo"
        ? `Pedido ${id} entrou em preparo.`
        : `Pedido ${id} foi liberado para retirada/entrega.`,
      variant: "success",
    });
    void dispatchOrderStatusNotification(
      slug,
      order,
      nextStatus === "Em preparo" ? "PREPARING" : "READY",
    ).then((result) => {
      if (result.status === "sent") {
        showToast({ title: "WhatsApp enviado", description: `Cliente do pedido ${id} foi notificado.`, variant: "success" });
      } else if (result.status === "simulated") {
        showToast({ title: "Aviso WhatsApp simulado", description: "Configure o proxy Evolution para enviar ao telefone real.", variant: "info" });
      }
    });
  }

  async function advanceApiOrder(order: ApiOrder, status: "PREPARANDO" | "ENTREGUE") {
    try {
      await data.updateOrderStatus(order.id, status);
      await apiOrders.reload();
      showToast({
        title: status === "PREPARANDO" ? "Preparo iniciado" : "Pedido pronto",
        description: `Pedido #${order.id} atualizado.`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Não foi possível atualizar o pedido",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    }
  }

  function printKitchenOrder(orderId: string) {
    const order = operations.orders.find((item) => item.id === orderId);
    if (!tenant || !order) return;
    const opened = printThermalReceipt({
      kind: "kitchen",
      restaurantSlug: tenant.restaurantSlug,
      restaurant: tenant.restaurant,
      cnpj: branding.cnpj,
      documentId: order.id,
      customer: order.customer,
      table: order.table,
      operator: tenant.name,
      items: order.items.map((item) => ({ name: item.name, quantity: item.qty, unitPrice: item.price })),
      showPrices: false,
      fields: [{ label: "Origem", value: order.orderType }, { label: "Prazo", value: order.eta }],
      footer: "Preparar e conferir itens",
    }, paperWidth);
    if (!opened) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para imprimir a comanda da cozinha.", variant: "warning" });
  }

  const statusClasses = {
    Pendente: "bg-amber-100 text-amber-700",
    "Em preparo": "bg-sky-100 text-sky-700",
    Pronto: "bg-emerald-100 text-emerald-700",
  } as const;
  const visibleOrders = operations.orders.filter((order) => orderFilter === "Todos" || order.orderType === orderFilter);
  const visibleApiOrders = (apiOrders.data ?? []).slice(0, 20).filter((order) => {
    const orderType = order.source === "qrcode" ? "Salão" : order.source === "delivery" ? "Delivery / WhatsApp" : "Balcão";
    return orderFilter === "Todos" || orderFilter === orderType;
  });

  return (
    <AppShell tenant={tenant} title="Cozinha" subtitle={`${tenant.restaurant} · pedidos ativos e preparo em andamento`}>
      <PrintDevicePanel restaurant={tenant.restaurant} slug={slug} cnpj={branding.cnpj} />
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Pedidos do cardápio digital</h2>
            <p className="mt-1 text-[12px] text-stone-500">Atualização automática · as mudanças de status aparecem para o cliente.</p>
          </div>
          {apiOrders.error ? (
            <button type="button" onClick={() => apiOrders.reload()} className="text-xs font-semibold text-red-700 underline">
              Erro ao sincronizar · tentar novamente
            </button>
          ) : null}
        </div>
        {visibleApiOrders.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleApiOrders.map((order) => {
              const orderType = order.source === "qrcode" ? "Salão" : order.source === "delivery" ? "Delivery / WhatsApp" : "Balcão";
              const statusLabel = order.status === "PENDENTE"
                ? "Pendente"
                : order.status === "PREPARANDO"
                  ? "Em preparo"
                  : order.status === "ENTREGUE"
                    ? "Pronto"
                    : order.status === "SAIU_PARA_ENTREGA"
                      ? "Saiu para entrega"
                      : order.status === "FINALIZADO"
                        ? "Finalizado"
                        : "Cancelado";
              const items = order.itemsJson ?? [];
              return (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-lg font-semibold">Pedido #{order.id}</p>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold">{statusLabel}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {orderType}{order.tableLabel ? ` · ${order.tableLabel}` : order.tableId ? ` · Mesa ${order.tableId}` : ""}{order.paymentMethod ? ` · Pagamento: ${order.paymentMethod}` : ""} · {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-3 text-[13px] font-medium">
                    {items.length ? items.map((item) => `${item.quantity}x ${item.name}`).join(" · ") : order.orderDetails}
                  </p>
                  {order.notes ? <p className="mt-1 text-[12px] text-stone-500">Obs.: {order.notes}</p> : null}
                  {order.status === "PENDENTE" ? (
                    <button type="button" onClick={() => void advanceApiOrder(order, "PREPARANDO")} className="mt-4 w-full rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                      Iniciar preparo
                    </button>
                  ) : order.status === "PREPARANDO" ? (
                    <button type="button" onClick={() => void advanceApiOrder(order, "ENTREGUE")} className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-emerald-700">
                      Marcar como pronto
                    </button>
                  ) : order.status === "ENTREGUE" ? (
                    <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-center text-[12px] font-medium text-emerald-700">Pronto para retirada</p>
                  ) : order.status === "SAIU_PARA_ENTREGA" ? (
                    <p className="mt-4 rounded-md bg-sky-50 px-3 py-2 text-center text-[12px] font-medium text-sky-700">Pedido a caminho do cliente</p>
                  ) : order.status === "FINALIZADO" ? (
                    <p className="mt-4 rounded-md bg-stone-100 px-3 py-2 text-center text-[12px] font-medium text-stone-600">Pedido concluído</p>
                  ) : null}
                  <OrderStatusHistory orderId={order.id} />
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 text-[13px] text-stone-500">{apiOrders.error || "Nenhum pedido recente do cardápio digital."}</Card>
        )}
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md bg-stone-200 p-1" role="group" aria-label="Filtrar pedidos por tipo">
          {(["Todos", "Balcão", "Salão", "Delivery / WhatsApp"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setOrderFilter(filter)}
              aria-pressed={orderFilter === filter}
              className={`rounded px-3 py-1.5 text-[12px] font-medium transition ${orderFilter === filter ? "bg-white text-ink shadow-sm" : "text-stone-600 hover:text-ink"}`}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-stone-500">Alerta vermelho: pedido ativo aguardando há mais de 20 min</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOrders.map((order) => {
          const overdue = order.waitMinutes > 20 && order.kitchenStatus !== "Pronto";
          return (
          <Card key={order.id} className={`p-4 ${overdue ? "animate-pulse border-red-500 bg-red-50 ring-2 ring-red-500" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-semibold">{order.id}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClasses[order.kitchenStatus]}`}>
                {order.kitchenStatus}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">{order.orderType}</span>
              <span className={`text-[11px] font-medium ${overdue ? "text-red-700" : "text-stone-500"}`}>
                {overdue ? "Atrasado · " : "Aguardando · "}{order.waitMinutes} min
              </span>
            </div>
            <p className="mt-3 text-[13px] font-medium">{order.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")}</p>
            <p className="mt-1 text-[12px] text-stone-500">Cliente: {order.customer} · {order.eta}</p>
            {order.kitchenStatus === "Pendente" ? (
              <button
                type="button"
                onClick={() => advanceOrder(order.id, "Em preparo")}
                className="mt-4 w-full rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep"
              >
                Iniciar Preparo
              </button>
            ) : order.kitchenStatus === "Em preparo" ? (
              <button
                type="button"
                onClick={() => advanceOrder(order.id, "Pronto")}
                className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-emerald-700"
              >
                Marcar como Pronto
              </button>
            ) : (
              <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-center text-[12px] font-medium text-emerald-700">
                Aguardando retirada ou entrega
              </p>
            )}
            <button type="button" onClick={() => printKitchenOrder(order.id)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="size-4" /> Imprimir Comanda
            </button>
          </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

function OrderStatusHistory({ orderId }: { orderId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<ApiOrderStatusHistory[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!expanded || history) return;
    let active = true;
    api.orderStatusHistory(orderId)
      .then((entries) => { if (active) setHistory(entries); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico.");
      });
    return () => { active = false; };
  }, [expanded, history, orderId]);

  return (
    <div className="mt-3 border-t border-black/5 pt-2">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="text-[11px] font-semibold text-stone-600 hover:text-brand">
        {expanded ? "Ocultar histórico" : "Ver histórico"}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2">
          {error ? (
            <div className="text-[11px] text-red-700">
              {error}{" "}
              <button type="button" onClick={() => { setError(""); setHistory(null); }} className="font-semibold underline">Tentar novamente</button>
            </div>
          ) : null}
          {!history && !error ? <p className="text-[11px] text-stone-500">Carregando histórico...</p> : null}
          {history?.map((entry, index) => (
            <div key={`${entry.changedAt}-${index}`} className="border-l-2 border-stone-200 pl-2 text-[11px]">
              <p className="font-medium">{entry.previousStatus ? `${entry.previousStatus} → ` : ""}{entry.newStatus}</p>
              <p className="text-stone-500">
                {new Date(entry.changedAt).toLocaleString("pt-BR")} · {entry.operatorLabel ?? entry.source}
              </p>
              {entry.reason ? <p className="text-stone-500">{entry.reason}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
