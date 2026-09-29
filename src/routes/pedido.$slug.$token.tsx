import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Card } from "@/components/app-shell";
import { useTenantOperations, updateTenantOperations } from "@/lib/operations";

export const Route = createFileRoute("/pedido/$slug/$token")({ component: PublicOrderTracking });

function PublicOrderTracking() {
  const { slug, token } = Route.useParams();
  const { operations } = useTenantOperations(slug);
  const [hydrated, setHydrated] = useState(false);
  const order = operations.orders.find((item) => item.trackingToken === token);
  const trackedOrderId = order?.id;
  const deliveryStatus = order?.deliveryStatus;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!trackedOrderId || deliveryStatus !== "Em rota") return;
    const interval = window.setInterval(() => {
      updateTenantOperations(slug, (current) => ({
        ...current,
        orders: current.orders.map((item) => item.trackingToken === token && item.deliveryStatus === "Em rota"
          ? { ...item, routeProgress: Math.min(95, (item.routeProgress ?? 8) + 5) }
          : item),
      }));
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [deliveryStatus, slug, token, trackedOrderId]);

  if (!hydrated) {
    return <main className="grid min-h-screen place-items-center bg-stone-50 p-4 text-[13px] text-stone-500">Carregando rastreio...</main>;
  }

  if (!order) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 p-4 text-ink">
        <Card className="max-w-md p-7 text-center">
          <h1 className="font-display text-xl font-semibold">Rastreio indisponível</h1>
          <p className="mt-2 text-[13px] text-stone-500">Este link não corresponde a um pedido ativo deste restaurante.</p>
        </Card>
      </main>
    );
  }

  const progress = order.deliveryStatus === "Entregue" ? 100 : order.deliveryStatus === "Em rota" ? Math.max(8, order.routeProgress ?? 8) : 0;
  const title = order.deliveryStatus === "Entregue" ? "Pedido entregue" : order.deliveryStatus === "Em rota" ? "Saiu para entrega" : "Pedido confirmado";

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-ink sm:py-14">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Acompanhe seu pedido</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-[13px] text-stone-500">{order.customer} · {order.id}</p>
        </header>

        <Card className="overflow-hidden">
          <div className="relative h-52 overflow-hidden bg-emerald-50 sm:h-64">
            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(90deg, transparent 48%, #d4ded6 49%, #d4ded6 51%, transparent 52%), linear-gradient(0deg, transparent 48%, #d4ded6 49%, #d4ded6 51%, transparent 52%)", backgroundSize: "70px 70px" }} />
            <div className="absolute left-[14%] top-[63%] h-1 w-[72%] -rotate-[15deg] rounded-full bg-stone-300" />
            <div className="absolute left-[14%] top-[63%] h-1 rounded-full bg-emerald-600 transition-[width] duration-1000" style={{ width: `${progress * 0.72}%`, transform: "rotate(-15deg)", transformOrigin: "left center" }} />
            <div className="absolute left-[12%] top-[56%] grid size-9 place-items-center rounded-full bg-white text-[10px] font-bold text-emerald-700 shadow ring-1 ring-emerald-200">LOJA</div>
            <div className="absolute right-[10%] top-[22%] grid size-9 place-items-center rounded-full bg-white text-[10px] font-bold text-stone-700 shadow ring-1 ring-black/10">VOCÊ</div>
            {order.deliveryStatus === "Em rota" && <span className="absolute top-[47%] grid size-9 place-items-center rounded-full bg-emerald-700 text-white shadow" style={{ left: `calc(12% + ${progress * 0.68}%)` }}><span className="text-base">●</span></span>}
            <div className="absolute bottom-3 left-3 rounded-md bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm backdrop-blur">Rota simulada · {progress}%</div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-stone-500">Previsão de chegada</p>
                <p className="mt-1 font-display text-xl font-semibold">{order.deliveryStatus === "Entregue" ? "Chegou" : order.eta}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${order.deliveryStatus === "Entregue" ? "bg-emerald-100 text-emerald-700" : order.deliveryStatus === "Em rota" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                {order.deliveryStatus}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Endereço</p><p className="mt-1 text-[13px] font-medium">{order.address}</p></div>
          <div className="border-t border-black/5 pt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Itens</p><p className="mt-1 text-[12px] leading-relaxed text-stone-600">{order.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")}</p></div>
          {order.driverName && <p className="border-t border-black/5 pt-3 text-[12px] text-stone-500">Entregador: <span className="font-medium text-ink">{order.driverName}</span></p>}
        </Card>
        <p className="text-center text-[10px] text-stone-400">Atualização demonstrativa do deslocamento · {order.customer}</p>
      </div>
    </main>
  );
}
