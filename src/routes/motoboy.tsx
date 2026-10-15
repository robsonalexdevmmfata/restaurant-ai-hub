import { createFileRoute } from "@tanstack/react-router";
import { Check, ExternalLink, MapPin, Navigation, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { api, getToken, type ApiDelivery } from "@/lib/api";
import { dispatchOrderStatusNotification } from "@/lib/delivery-notifications";
import { distanceBetweenKm, geocodeBrazilPostalCode, getDeliveryDistance, optimizeDeliveryRoute } from "@/lib/delivery-routing";
import { brl } from "@/lib/mock";
import { calculateDeliveryFee, createStaffActivity, useTenantOperations, type DeliveryCollectionMethod, type GeoPoint } from "@/lib/operations";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/motoboy")({
  component: DeliveryView,
});

function DeliveryView() {
  const { tenant, loading } = useRequireTenant(["motoboy", "gerente"]);
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { operations, update } = useTenantOperations(slug);
  const { branding } = useTenantBranding(slug);
  const [collectionMethods, setCollectionMethods] = useState<Record<string, DeliveryCollectionMethod>>({});
  const [orderPaymentMethods, setOrderPaymentMethods] = useState<Record<string, "Não recebido" | "Dinheiro" | "PIX">>({});
  const [cashCollections, setCashCollections] = useState<Record<string, string>>({});
  const [destinationDrafts, setDestinationDrafts] = useState<Record<string, { postalCode: string; latitude: string; longitude: string }>>({});
  const [originLatitude, setOriginLatitude] = useState("");
  const [originLongitude, setOriginLongitude] = useState("");
  const [persistedDeliveries, setPersistedDeliveries] = useState<ApiDelivery[]>([]);
  const [persistedHistory, setPersistedHistory] = useState<Awaited<ReturnType<typeof api.listDeliveryHistory>>>([]);
  const [deliveryApiError, setDeliveryApiError] = useState("");
  const hasPersistentDeliveryApi = Boolean(getToken());

  async function refreshPersistentDeliveries() {
    const [deliveries, history] = await Promise.all([api.listDeliveries(), api.listDeliveryHistory()]);
    setPersistedDeliveries(deliveries);
    setPersistedHistory(history);
    setDeliveryApiError("");
  }

  useEffect(() => {
    if (!hasPersistentDeliveryApi) return;
    let active = true;
    const refresh = async () => {
      try {
        const [deliveries, history] = await Promise.all([api.listDeliveries(), api.listDeliveryHistory()]);
        if (active) {
          setPersistedDeliveries(deliveries);
          setPersistedHistory(history);
          setDeliveryApiError("");
        }
      } catch (error) {
        if (active) setDeliveryApiError(error instanceof Error ? error.message : "Não foi possível carregar a fila de entregas.");
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [hasPersistentDeliveryApi]);

  useEffect(() => {
    setOriginLatitude(String(operations.deliveryOrigin.latitude));
    setOriginLongitude(String(operations.deliveryOrigin.longitude));
  }, [operations.deliveryOrigin.latitude, operations.deliveryOrigin.longitude]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const pendingDeliveries = hasPersistentDeliveryApi
    ? persistedDeliveries.map(({ order, assignment, driverName }) => ({
        id: String(order.id),
        customer: order.customerName ?? "Cliente",
        table: "Delivery",
        address: order.deliveryAddress ?? "Endereço não informado",
        eta: "A calcular",
        items: order.itemsJson?.map((item) => ({ name: item.name, qty: item.quantity, price: item.price })) ?? [],
        kitchenStatus: order.status === "PREPARANDO" ? "Em preparo" as const : order.status === "ENTREGUE" ? "Pronto" as const : "Pendente" as const,
        paymentStatus: "Pendente" as const,
        paymentMethod: undefined,
        deliveryStatus: assignment.status === "EM_ROTA" ? "Em rota" as const : "Disponível" as const,
        orderType: "Delivery / WhatsApp" as const,
        waitMinutes: 0,
        neighborhood: order.deliveryNeighborhood ?? "Bairro não informado",
        distanceKm: 0,
        postalCode: order.deliveryPostalCode ?? undefined,
        customerPhone: order.customerPhone ?? undefined,
        driverName: driverName ?? undefined,
        trackingToken: order.trackingToken ?? undefined,
      }))
    : operations.orders.filter((order) => order.orderType === "Delivery / WhatsApp" && order.deliveryStatus !== "Entregue");
  const routePlan = optimizeDeliveryRoute(pendingDeliveries, operations.deliveryOrigin, branding.deliveryFees);
  const activeDeliveries = routePlan.map((stop) => stop.order);

  function openMaps(address: string) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank", "noopener,noreferrer");
  }

  function saveRestaurantOrigin() {
    if (!originLatitude.trim() || !originLongitude.trim()) {
      showToast({ title: "Informe a origem", description: "Preencha a latitude e longitude do restaurante.", variant: "warning" });
      return;
    }
    const latitude = Number(originLatitude);
    const longitude = Number(originLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      showToast({ title: "Coordenadas inválidas", description: "Informe latitude entre -90 e 90 e longitude entre -180 e 180.", variant: "warning" });
      return;
    }
    const origin = { latitude, longitude };
    update((current) => ({
      ...current,
      deliveryOrigin: origin,
      orders: current.orders.map((order) => Number.isFinite(order.latitude) && Number.isFinite(order.longitude)
        ? { ...order, distanceKm: Math.round(distanceBetweenKm(origin, { latitude: order.latitude!, longitude: order.longitude! }) * 100) / 100 }
        : order),
    }));
    showToast({ title: "Origem da rota atualizada", description: "As distâncias e a sequência das próximas entregas foram recalculadas.", variant: "success" });
  }

  function saveDestination(id: string) {
    const draft = destinationDrafts[id];
    if (!draft?.latitude.trim() || !draft.longitude.trim()) {
      showToast({ title: "Destino sem coordenadas", description: "Geocodifique o CEP ou informe latitude e longitude.", variant: "warning" });
      return;
    }
    const latitude = Number(draft?.latitude);
    const longitude = Number(draft?.longitude);
    if (!draft || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      showToast({ title: "Coordenadas inválidas", description: "Geocodifique o CEP ou informe latitude e longitude válidas.", variant: "warning" });
      return;
    }
    const distanceKm = Math.round(distanceBetweenKm(operations.deliveryOrigin, { latitude, longitude }) * 100) / 100;
    update((current) => ({
      ...current,
      orders: current.orders.map((order) => order.id === id
        ? { ...order, latitude, longitude, postalCode: draft.postalCode, distanceKm }
        : order),
    }));
    showToast({ title: "Destino atualizado", description: `Distância estimada: ${distanceKm.toFixed(2)} km.`, variant: "success" });
  }

  async function geocodeDestination(id: string) {
    const order = operations.orders.find((item) => item.id === id);
    const postalCode = destinationDrafts[id]?.postalCode ?? order?.postalCode ?? "";
    const point = await geocodeBrazilPostalCode(postalCode);
    if (!point) {
      showToast({ title: "CEP não localizado", description: "Verifique o CEP ou informe as coordenadas manualmente.", variant: "warning" });
      return;
    }
    setDestinationDrafts((current) => ({
      ...current,
      [id]: { postalCode, latitude: String(point.latitude), longitude: String(point.longitude) },
    }));
    showToast({ title: "CEP localizado", description: "Confira o ponto e salve para atualizar a rota.", variant: "success" });
  }

  async function startDelivery(id: string, address: string) {
    if (!tenant) return;
    if (!hasPersistentDeliveryApi && !operations.deliveryShiftStartedAt) {
      showToast({ title: "Inicie seu turno", description: "Abra o turno antes de sair para uma entrega.", variant: "warning" });
      return;
    }
    const order = operations.orders.find((item) => item.id === id);
    if (hasPersistentDeliveryApi) {
      try {
        await api.startDelivery(Number(id));
        await refreshPersistentDeliveries();
        openMaps(address);
        showToast({ title: "Rota iniciada", description: `Pedido ${id} atribuído a ${tenant.name}.`, variant: "success" });
      } catch (error) {
        showToast({ title: "Não foi possível iniciar a rota", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
      }
      return;
    }
    if (!order || order.deliveryStatus !== "Disponível") return;
    const trackingToken = order.trackingToken ?? crypto.randomUUID();
    let routeStarted = false;
    update((current) => {
      const order = current.orders.find((item) => item.id === id);
      if (!tenant || !order || order.deliveryStatus !== "Disponível") return current;
      routeStarted = true;
      return {
        ...current,
        orders: current.orders.map((item) => item.id === id
          ? { ...item, deliveryStatus: "Em rota", driverName: tenant.name, trackingToken, routeProgress: 8 }
          : item),
        staffAudit: [createStaffActivity(tenant, {
          kind: "delivery",
          title: `Iniciou entrega ${id}`,
          details: `Rota para ${order.neighborhood} iniciada.`,
          relatedId: id,
        }), ...current.staffAudit],
      };
    });
    if (!routeStarted) return;
    void dispatchOrderStatusNotification(
      tenant.restaurantSlug,
      { ...order, deliveryStatus: "Em rota", driverName: tenant.name, trackingToken },
      "OUT_FOR_DELIVERY",
      tenant.name,
      order.eta,
    ).then((result) => {
      if (result.status === "sent") {
        showToast({ title: "Cliente notificado", description: `O pedido ${id} saiu para entrega.`, variant: "success" });
      } else if (result.status === "simulated") {
        showToast({ title: "Aviso WhatsApp simulado", description: "Configure o proxy Evolution para enviar ao telefone real.", variant: "info" });
      }
    });
    openMaps(address);
    showToast({ title: "Rota iniciada", description: `Pedido ${id}: abrindo endereço no Google Maps.`, variant: "info" });
  }

  async function confirmDelivery(id: string) {
    if (hasPersistentDeliveryApi) {
      try {
        await api.completeDelivery(Number(id));
        await refreshPersistentDeliveries();
        showToast({ title: "Entrega registrada", description: `O histórico persistido do pedido ${id} foi atualizado.`, variant: "success" });
      } catch (error) {
        showToast({ title: "Não foi possível concluir a entrega", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
      }
      return;
    }
    const delivery = operations.orders.find((item) => item.id === id);
    if (!delivery || delivery.deliveryStatus !== "Em rota") return;
    const method = collectionMethods[id] ?? "PIX";
    const distanceKm = getDeliveryDistance(delivery, operations.deliveryOrigin);
    const fee = calculateDeliveryFee(delivery.neighborhood, distanceKm, branding.deliveryFees);
    const orderPaymentMethod = orderPaymentMethods[id] ?? "Não recebido";
    const orderAmountCollected = Math.max(0, Number(cashCollections[id] ?? "0") || 0);
    if (orderPaymentMethod !== "Não recebido" && orderAmountCollected <= 0) {
      showToast({ title: "Informe o valor recebido", description: "Registre o valor do pedido coletado no endereço.", variant: "warning" });
      return;
    }
    let deliveryRecorded = false;
    update((current) => {
      const order = current.orders.find((item) => item.id === id);
      if (!order || order.deliveryStatus !== "Em rota") return current;

      deliveryRecorded = true;
      const orderCollected = orderPaymentMethod === "Não recebido" ? 0 : orderAmountCollected;
      const cashAtDoor = (method === "Dinheiro" ? fee : 0) + (orderPaymentMethod === "Dinheiro" ? orderCollected : 0);
      const pixAtDoor = (method === "PIX" ? fee : 0) + (orderPaymentMethod === "PIX" ? orderCollected : 0);
      return {
        ...current,
        deliveredCount: current.deliveredCount + 1,
        revenue: current.revenue + orderCollected + fee,
        paidOrderCount: current.paidOrderCount + (orderCollected > 0 ? 1 : 0),
        cashShift: {
          ...current.cashShift,
          received: {
            ...current.cashShift.received,
            Dinheiro: current.cashShift.received.Dinheiro + cashAtDoor,
            PIX: current.cashShift.received.PIX + pixAtDoor,
          },
        },
        deliveryHistory: [
          ...current.deliveryHistory,
          {
            orderId: id,
            customer: order.customer,
            neighborhood: order.neighborhood,
            distanceKm,
            fee,
            method,
            orderAmountCollected: orderCollected,
            orderPaymentMethod: orderCollected > 0 && orderPaymentMethod !== "Não recebido" ? orderPaymentMethod : undefined,
            completedAt: new Date().toISOString(),
          },
        ],
        staffAudit: [createStaffActivity(tenant!, {
          kind: "delivery",
          title: `Concluiu entrega ${id}`,
          details: `${order.neighborhood} · taxa ${brl(fee)} recebida via ${method}.`,
          relatedId: id,
        }), ...current.staffAudit],
        orders: current.orders.map((item) => item.id === id
          ? {
              ...item,
              deliveryStatus: "Entregue",
              paymentStatus: orderCollected > 0 ? "Pago" : item.paymentStatus,
              paymentMethod: orderCollected > 0 && orderPaymentMethod !== "Não recebido" ? orderPaymentMethod : item.paymentMethod,
            }
          : item),
      };
    });
    if (!deliveryRecorded) return;

    showToast({
      title: "Entrega confirmada",
      description: `${brl(fee)} de taxa via ${method}${orderAmountCollected > 0 ? ` · ${brl(orderAmountCollected)} do pedido via ${orderPaymentMethod}` : ""}.`,
      variant: "success",
    });
  }

  const statusClasses = {
    Disponível: "bg-emerald-100 text-emerald-700",
    "Em rota": "bg-sky-100 text-sky-700",
    Entregue: "bg-stone-200 text-stone-700",
  } as const;
  const pixFees = operations.deliveryHistory.filter((entry) => entry.method === "PIX").reduce((sum, entry) => sum + entry.fee, 0);
  const cashFees = operations.deliveryHistory.filter((entry) => entry.method === "Dinheiro").reduce((sum, entry) => sum + entry.fee, 0);
  const cashOrderCollections = operations.deliveryHistory.filter((entry) => entry.orderPaymentMethod === "Dinheiro").reduce((sum, entry) => sum + (entry.orderAmountCollected ?? 0), 0);
  const pixOrderCollections = operations.deliveryHistory.filter((entry) => entry.orderPaymentMethod === "PIX").reduce((sum, entry) => sum + (entry.orderAmountCollected ?? 0), 0);
  const streetCashTotal = cashFees + cashOrderCollections;
  const streetPixTotal = pixFees + pixOrderCollections;
    const totalStreetCollections = streetCashTotal + streetPixTotal;

  function startShift() {
    update((current) => ({
      ...current,
      deliveryShiftStartedAt: new Date().toISOString(),
      deliveryHistory: [],
      staffAudit: [createStaffActivity(tenant!, {
        kind: "shift",
        title: "Iniciou turno de entregas",
        details: "Histórico de entregas reiniciado para o novo turno.",
      }), ...current.staffAudit],
    }));
    showToast({ title: "Turno iniciado", description: "O histórico de entregas deste turno foi iniciado.", variant: "success" });
  }

  function endShift() {
    if (operations.orders.some((order) => order.deliveryStatus === "Em rota")) {
      showToast({ title: "Há entregas em andamento", description: "Confirme as entregas na rua antes de encerrar o turno.", variant: "warning" });
      return;
    }
    update((current) => ({
      ...current,
      deliveryShiftStartedAt: null,
      staffAudit: [createStaffActivity(tenant!, {
        kind: "shift",
        title: "Encerrou turno de entregas",
        details: `Prestação de contas: ${brl(streetCashTotal)} em dinheiro e ${brl(streetPixTotal)} via PIX.`,
      }), ...current.staffAudit],
    }));
    showToast({ title: "Turno encerrado", description: `Total arrecadado na rua: ${brl(totalStreetCollections)}.`, variant: "success" });
  }

  return (
    <AppShell tenant={tenant} title="Entregas / Delivery" subtitle={`${tenant.restaurant} · rotas e entregas em andamento`}>
      {deliveryApiError && hasPersistentDeliveryApi && <div role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">{deliveryApiError} · As ações de entrega não foram substituídas por dados locais.</div>}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold">Rota inteligente</h2>
            <p className="mt-1 text-[11px] text-stone-500">Agrupamento por bairro e distância estimada a partir do restaurante.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{routePlan.length} paradas</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-[10px] font-medium text-stone-500">Latitude do restaurante
            <input value={originLatitude} onChange={(event) => setOriginLatitude(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
          </label>
          <label className="block text-[10px] font-medium text-stone-500">Longitude do restaurante
            <input value={originLongitude} onChange={(event) => setOriginLongitude(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
          </label>
          <button type="button" onClick={saveRestaurantOrigin} className="rounded-md bg-brand px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-deep">Salvar origem</button>
        </div>
        {routePlan.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
            {routePlan.map((stop, index) => (
              <span key={stop.order.id} className="rounded-md bg-stone-50 px-2.5 py-1.5 text-[10px] text-stone-600">
                {String(index + 1).padStart(2, "0")} · {stop.order.neighborhood} · {stop.distanceKm.toFixed(1)} km
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Entrega atual", detail: activeDeliveries.find((order) => order.deliveryStatus === "Em rota")?.address ?? "Nenhuma rota ativa" },
          { title: "Pedidos no percurso", detail: String(activeDeliveries.length) },
          { title: "Entregas concluídas hoje", detail: String(operations.deliveredCount) },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <p className="text-[12px] font-medium text-stone-500">{item.title}</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{item.detail}</p>
          </Card>
        ))}
      </div>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold">Rotas ativas</h2>
            <p className="mt-1 text-[12px] text-stone-500">Pedidos disponíveis e em deslocamento.</p>
          </div>
              <span className="text-[11px] font-medium text-stone-500">{activeDeliveries.length} pendentes</span>
        </div>

        {activeDeliveries.length ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {routePlan.map(({ order: delivery, distanceKm, fee }, stopIndex) => (
                <Card key={delivery.id} className="flex min-h-full flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                      <p className="font-display text-xl font-semibold">Parada {String(stopIndex + 1).padStart(2, "0")} · {delivery.id}</p>
                    <p className="mt-1 text-[12px] text-stone-500">{delivery.customer}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClasses[delivery.deliveryStatus]}`}>
                    {delivery.deliveryStatus}
                  </span>
                </div>

                <div className="mt-4 space-y-2 rounded-md bg-stone-50 p-3">
                  <p className="flex items-start gap-2 text-[13px] font-medium">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{delivery.address}</span>
                  </p>
                    <p className="pl-6 text-[11px] text-stone-500">{delivery.neighborhood} · {distanceKm.toFixed(1)} km · ETA {delivery.eta}</p>
                    <p className="pl-6 text-[12px] font-semibold text-brand">Taxa estimada {brl(fee)}</p>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-stone-600">{delivery.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")}</p>
                  <details className="mt-3 rounded-md border border-black/5 bg-white px-3 py-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-stone-600">CEP / coordenadas do destino</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input
                        value={destinationDrafts[delivery.id]?.postalCode ?? delivery.postalCode ?? ""}
                        onChange={(event) => setDestinationDrafts((current) => ({ ...current, [delivery.id]: { postalCode: event.target.value, latitude: current[delivery.id]?.latitude ?? String(delivery.latitude ?? ""), longitude: current[delivery.id]?.longitude ?? String(delivery.longitude ?? "") } }))}
                        placeholder="CEP"
                        aria-label={`CEP do pedido ${delivery.id}`}
                        className="rounded border border-black/10 px-2 py-1.5 text-[10px]"
                      />
                      <button type="button" onClick={() => void geocodeDestination(delivery.id)} className="rounded border border-black/10 bg-stone-50 px-2 py-1.5 text-[10px] font-medium hover:bg-stone-100">Localizar CEP</button>
                      <input
                        value={destinationDrafts[delivery.id]?.latitude ?? String(delivery.latitude ?? "")}
                        onChange={(event) => setDestinationDrafts((current) => ({ ...current, [delivery.id]: { postalCode: current[delivery.id]?.postalCode ?? delivery.postalCode ?? "", latitude: event.target.value, longitude: current[delivery.id]?.longitude ?? String(delivery.longitude ?? "") } }))}
                        placeholder="Latitude"
                        aria-label={`Latitude do pedido ${delivery.id}`}
                        className="rounded border border-black/10 px-2 py-1.5 text-[10px]"
                      />
                      <input
                        value={destinationDrafts[delivery.id]?.longitude ?? String(delivery.longitude ?? "")}
                        onChange={(event) => setDestinationDrafts((current) => ({ ...current, [delivery.id]: { postalCode: current[delivery.id]?.postalCode ?? delivery.postalCode ?? "", latitude: current[delivery.id]?.latitude ?? String(delivery.latitude ?? ""), longitude: event.target.value } }))}
                        placeholder="Longitude"
                        aria-label={`Longitude do pedido ${delivery.id}`}
                        className="rounded border border-black/10 px-2 py-1.5 text-[10px]"
                      />
                      <button type="button" onClick={() => saveDestination(delivery.id)} className="rounded bg-brand px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-brand-deep sm:col-span-2">Salvar destino e recalcular distância</button>
                    </div>
                  </details>

                {delivery.deliveryStatus === "Em rota" && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-[11px] font-medium text-stone-500">
                        <span className="flex items-center gap-1.5"><Wallet className="size-3.5" />Recebimento da taxa de entrega</span>
                        <select
                          value={collectionMethods[delivery.id] ?? "PIX"}
                          onChange={(event) => setCollectionMethods((current) => ({ ...current, [delivery.id]: event.target.value as DeliveryCollectionMethod }))}
                          className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"
                        >
                          <option value="PIX">PIX</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>
                      </label>
                      <label className="block text-[11px] font-medium text-stone-500">
                        Pagamento do pedido no endereço
                        <select
                          value={orderPaymentMethods[delivery.id] ?? "Não recebido"}
                          onChange={(event) => {
                            const method = event.target.value as "Não recebido" | "Dinheiro" | "PIX";
                            setOrderPaymentMethods((current) => ({ ...current, [delivery.id]: method }));
                            if (method !== "Não recebido") {
                              const orderTotal = delivery.items.reduce((sum, item) => sum + item.qty * item.price, 0);
                              setCashCollections((current) => ({ ...current, [delivery.id]: current[delivery.id] ?? orderTotal.toFixed(2) }));
                            }
                          }}
                          className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"
                        >
                          <option value="Não recebido">Já pago / não cobrar</option>
                          <option value="Dinheiro">Receber pedido em dinheiro</option>
                          <option value="PIX">Receber pedido via PIX</option>
                        </select>
                      </label>
                      {orderPaymentMethods[delivery.id] && orderPaymentMethods[delivery.id] !== "Não recebido" && (
                        <label className="block text-[11px] font-medium text-stone-500">
                          Valor do pedido recebido (R$) · itens {brl(delivery.items.reduce((sum, item) => sum + item.qty * item.price, 0))}
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={cashCollections[delivery.id] ?? ""}
                            onChange={(event) => setCashCollections((current) => ({ ...current, [delivery.id]: event.target.value }))}
                            className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"
                          />
                        </label>
                      )}
                    </div>
                )}

                  <div className={`mt-auto grid ${delivery.trackingToken ? "grid-cols-[auto_auto_1fr]" : "grid-cols-[auto_1fr]"} gap-2 pt-5`}>
                      <button
                    type="button"
                    onClick={() => openMaps(delivery.address)}
                    aria-label={`Abrir rota do pedido ${delivery.id} no mapa`}
                    title="Ver no mapa"
                    className="grid size-10 place-items-center rounded-md border border-black/10 bg-white text-stone-700 transition hover:bg-stone-50"
                  >
                    <MapPin className="size-4" />
                  </button>
                    {delivery.trackingToken && (
                      <a
                        href={`/pedido/${slug}/${delivery.trackingToken}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir rastreio público do pedido ${delivery.id}`}
                        title="Rastreio público"
                        className="grid size-10 place-items-center rounded-md border border-black/10 bg-white text-stone-700 transition hover:bg-stone-50"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  <button
                    type="button"
                    onClick={() => (delivery.deliveryStatus === "Disponível" ? startDelivery(delivery.id, delivery.address) : confirmDelivery(delivery.id))}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-deep disabled:bg-stone-300"
                    disabled={!hasPersistentDeliveryApi && !operations.deliveryShiftStartedAt}
                  >
                    {delivery.deliveryStatus === "Disponível" ? <><Navigation className="size-4" />Iniciar Rota</> : <><Check className="size-4" />Confirmar Entrega</>}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-[13px] font-semibold">Nenhuma rota pendente</p>
            <p className="mt-1 text-[12px] text-stone-500">As próximas entregas aparecerão aqui.</p>
          </Card>
        )}
      </section>

      <Card className="mt-8 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[13px] font-semibold">{hasPersistentDeliveryApi ? "Histórico persistido de entregas" : "Histórico deste turno"}</p>
            <p className="mt-1 text-[11px] text-stone-500">{hasPersistentDeliveryApi
              ? "Conclusões registradas no servidor e compartilhadas com a equipe."
              : operations.deliveryShiftStartedAt
                ? `Iniciado às ${new Date(operations.deliveryShiftStartedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · taxas recebidas por entregas concluídas.`
                : "Turno encerrado · inicie um novo turno para começar outro histórico."}</p>
          </div>
          {!hasPersistentDeliveryApi && <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-5">
              <div><p className="text-[10px] text-stone-500">Taxas PIX</p><p className="text-[12px] font-semibold">{brl(pixFees)}</p></div>
              <div><p className="text-[10px] text-stone-500">Taxas espécie</p><p className="text-[12px] font-semibold">{brl(cashFees)}</p></div>
              <div><p className="text-[10px] text-stone-500">Pedidos PIX</p><p className="text-[12px] font-semibold">{brl(pixOrderCollections)}</p></div>
              <div><p className="text-[10px] text-stone-500">Pedidos em espécie</p><p className="text-[12px] font-semibold">{brl(cashOrderCollections)}</p></div>
              <div><p className="text-[10px] text-stone-500">Total prestado</p><p className="text-[12px] font-semibold text-brand">{brl(totalStreetCollections)}</p></div>
            </div>
            {operations.deliveryShiftStartedAt ? (
              <button type="button" onClick={endShift} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50">Encerrar turno · {brl(totalStreetCollections)}</button>
            ) : (
              <button type="button" onClick={startShift} className="rounded-md bg-brand px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-deep">Iniciar turno</button>
            )}
          </div>}
        </div>
        {hasPersistentDeliveryApi ? persistedHistory.length ? (
          <div className="divide-y divide-black/5">
            {persistedHistory.map((entry) => (
              <div key={`${entry.orderId}-${entry.deliveredAt}`} className="grid gap-1.5 px-4 py-3 text-[12px] sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4">
                <span className="font-medium">Pedido #{entry.orderId} · {entry.customerName ?? "Cliente"}</span>
                <span className="text-stone-500">{entry.deliveryNeighborhood ?? "Bairro não informado"} · {entry.driverName ?? "Entregador"} · {entry.deliveredAt ? new Date(entry.deliveredAt).toLocaleString("pt-BR") : "Horário indisponível"}</span>
                <span className="font-semibold sm:text-right">Pedido {brl(entry.total)}</span>
              </div>
            ))}
          </div>
        ) : <p className="p-4 text-[12px] text-stone-500">Nenhuma entrega concluída registrada no servidor.</p> : operations.deliveryHistory.length ? (
          <div className="divide-y divide-black/5">
            {operations.deliveryHistory.slice().reverse().map((entry) => (
              <div key={`${entry.orderId}-${entry.completedAt}`} className="grid gap-1.5 px-4 py-3 text-[12px] sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4">
                <span className="font-medium">{entry.orderId} · {entry.customer}</span>
                <span className="text-stone-500">{entry.neighborhood} · {entry.distanceKm.toFixed(1)} km · {new Date(entry.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-semibold sm:text-right">
                  Taxa {entry.method} {brl(entry.fee)}
                  {entry.orderAmountCollected ? ` · Pedido ${entry.orderPaymentMethod} ${brl(entry.orderAmountCollected)}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="p-4 text-[12px] text-stone-500">Nenhuma entrega concluída neste turno ainda.</p>}
      </Card>
    </AppShell>
  );
}
