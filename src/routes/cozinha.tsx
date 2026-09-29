import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { PrintDevicePanel } from "@/components/print-device-panel";
import { dispatchOrderStatusNotification } from "@/lib/delivery-notifications";
import { createStaffActivity, updateTenantOperations, useTenantOperations, type OrderType } from "@/lib/operations";
import { printThermalReceipt, useThermalPaperWidth } from "@/lib/thermal-print";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/cozinha")({
  component: KitchenView,
});

function KitchenView() {
  const { tenant, loading } = useRequireTenant("cozinha");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { operations, update } = useTenantOperations(slug);
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

  function printKitchenOrder(orderId: string) {
    const order = operations.orders.find((item) => item.id === orderId);
    if (!tenant || !order) return;
    const opened = printThermalReceipt({
      kind: "kitchen",
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

  return (
    <AppShell tenant={tenant} title="Cozinha" subtitle={`${tenant.restaurant} · pedidos ativos e preparo em andamento`}>
      <PrintDevicePanel restaurant={tenant.restaurant} slug={slug} cnpj={branding.cnpj} />
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
