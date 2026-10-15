import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { PrintDevicePanel } from "@/components/print-device-panel";
import { brl } from "@/lib/mock";
import { createStaffActivity, useTenantOperations, type DiscountType, type PaymentMethod } from "@/lib/operations";
import { hasPublicApi, publicApiUrl } from "@/lib/public-api";
import { printThermalReceipt, useThermalPaperWidth } from "@/lib/thermal-print";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/caixa")({
  head: () => ({ meta: [{ title: "Caixa e pagamentos — RestauranteAI" }, { name: "description", content: "RestauranteAI — caixa e pagamentos." }, { property: "og:title", content: "Caixa e pagamentos — RestauranteAI" }, { property: "og:description", content: "RestauranteAI — caixa e pagamentos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),

  component: CashierView,
});

function CashierView() {
  const { tenant, loading } = useRequireTenant("caixa");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { operations, update } = useTenantOperations(slug);
  const { branding } = useTenantBranding(slug);
  const { paperWidth } = useThermalPaperWidth(slug);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [cashReceived, setCashReceived] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("Percentual");
  const [discountValue, setDiscountValue] = useState("0");
  const [openingFloat, setOpeningFloat] = useState("");
  const [movementForm, setMovementForm] = useState({ kind: "Sangria" as "Sangria" | "Suprimento", amount: "", description: "" });

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const openOrders = operations.orders.filter((order) => order.paymentStatus === "Pendente");
  const tableOrders = openOrders.filter((order) => order.orderType === "Salão" && /^Mesa \d+$/i.test(order.table));
  const tableIdsWithOpenOrders = new Set(tableOrders.map((order) => Number(order.table.match(/\d+/)?.[0])));
  const openTables = operations.tables.filter((table) => tableIdsWithOpenOrders.has(table.id));
  const selectedOrder = operations.orders.find((order) => order.id === selectedOrderId);
  const selectedGross = selectedOrder?.items.reduce((total, item) => total + item.qty * item.price, 0) ?? 0;
  const selectedCouponDiscount = Math.min(selectedGross, selectedOrder?.couponDiscount ?? 0);
  const discountableTotal = selectedGross - selectedCouponDiscount;
  const parsedDiscount = Math.max(0, Number(discountValue.replace(",", ".")) || 0);
  const selectedDiscount = Math.min(
    discountableTotal,
    discountType === "Percentual" ? discountableTotal * Math.min(parsedDiscount, 100) / 100 : parsedDiscount,
  );
  const selectedTotal = discountableTotal - selectedDiscount;
  const amountReceived = Number(cashReceived.replace(",", ".")) || 0;
  const changeDue = paymentMethod === "Dinheiro" ? Math.max(0, Math.round((amountReceived - selectedTotal) * 100) / 100) : 0;
  const cashShift = operations.cashShift;
  const withdrawalTotal = cashShift.withdrawals.reduce((sum, movement) => sum + movement.amount, 0);
  const supplyTotal = cashShift.supplies.reduce((sum, movement) => sum + movement.amount, 0);
  const expectedCash = cashShift.openingFloat + cashShift.received.Dinheiro + supplyTotal - withdrawalTotal;
  const deliveryCash = operations.deliveryHistory.reduce((sum, entry) =>
    sum + (entry.method === "Dinheiro" ? entry.fee : 0) + (entry.orderPaymentMethod === "Dinheiro" ? entry.orderAmountCollected ?? 0 : 0), 0);
  const deliveryPix = operations.deliveryHistory.reduce((sum, entry) =>
    sum + (entry.method === "PIX" ? entry.fee : 0) + (entry.orderPaymentMethod === "PIX" ? entry.orderAmountCollected ?? 0 : 0), 0);

  function printOrder(order: NonNullable<typeof selectedOrder>, kind: "kitchen" | "payment") {
    if (!tenant) return;
    const opened = printThermalReceipt({
      kind,
      restaurant: tenant.restaurant,
      cnpj: branding.cnpj,
      documentId: order.id,
      customer: order.customer,
      table: order.table,
      operator: tenant.name,
      items: order.items.map((item) => ({ name: item.name, quantity: item.qty, unitPrice: item.price })),
      subtotal: selectedGross,
      discount: kind === "payment" ? selectedCouponDiscount + selectedDiscount : undefined,
      total: kind === "payment" ? selectedTotal : undefined,
      paymentMethod: kind === "payment" ? paymentMethod : undefined,
      amountReceived: kind === "payment" && paymentMethod === "Dinheiro" ? amountReceived : undefined,
      change: kind === "payment" && paymentMethod === "Dinheiro" ? changeDue : undefined,
      fields: [{ label: "Endereço", value: order.address }],
      footer: kind === "kitchen" ? "Comanda para conferência" : "Documento não fiscal · comprovante de pagamento",
    }, paperWidth);
    if (!opened) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para imprimir o documento térmico.", variant: "warning" });
  }

  function openShift(event: React.FormEvent) {
    event.preventDefault();
    const initial = Math.max(0, Number(openingFloat.replace(",", ".")) || 0);
    update((current) => ({
      ...current,
      cashShift: {
        ...current.cashShift,
        isOpen: true,
        openingFloat: initial,
        withdrawals: [],
        supplies: [],
        received: { PIX: 0, Cartão: 0, Dinheiro: 0 },
        openedAt: new Date().toISOString(),
      },
      staffAudit: [createStaffActivity(tenant!, {
        kind: "shift",
        title: "Abriu turno do caixa",
        details: `Fundo de troco inicial: ${brl(initial)}.`,
      }), ...current.staffAudit],
    }));
    setOpeningFloat("");
    showToast({ title: "Caixa aberto", description: `Fundo de troco de ${brl(initial)} registrado.`, variant: "success" });
  }

  function registerMovement(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(movementForm.amount.replace(",", "."));
    if (!cashShift.isOpen || !Number.isFinite(amount) || amount <= 0 || !movementForm.description.trim()) return;
    if (movementForm.kind === "Sangria" && amount > expectedCash) {
      showToast({ title: "Saldo insuficiente", description: "A sangria não pode superar o dinheiro disponível no caixa.", variant: "error" });
      return;
    }
    const movement = {
      id: `movement-${Date.now()}`,
      amount,
      description: movementForm.description.trim(),
      createdAt: new Date().toISOString(),
    };
    update((current) => ({
      ...current,
      cashShift: {
        ...current.cashShift,
        [movementForm.kind === "Sangria" ? "withdrawals" : "supplies"]: [
          ...(movementForm.kind === "Sangria" ? current.cashShift.withdrawals : current.cashShift.supplies),
          movement,
        ],
      },
    }));
    showToast({ title: `${movementForm.kind} registrada`, description: `${brl(amount)} lançado no caixa.`, variant: "success" });
    setMovementForm((current) => ({ ...current, amount: "", description: "" }));
  }

  function closeShift() {
    const sales = Object.values(cashShift.received).reduce((sum, amount) => sum + amount, 0);
    update((current) => ({
      ...current,
      cashShift: {
        ...current.cashShift,
        isOpen: false,
        lastClosing: { closedAt: new Date().toISOString(), expectedCash, sales },
      },
      staffAudit: [createStaffActivity(tenant!, {
        kind: "shift",
        title: "Fechou turno do caixa",
        details: `Dinheiro esperado ${brl(expectedCash)}; vendas do turno ${brl(sales)}.`,
      }), ...current.staffAudit],
    }));
    showToast({ title: "Caixa fechado", description: `Saldo esperado em dinheiro: ${brl(expectedCash)}.`, variant: "success" });
  }

  function payOrder() {
    if (!selectedOrder || selectedOrder.paymentStatus === "Pago") return;
    if (!cashShift.isOpen) {
      showToast({ title: "Abra o caixa primeiro", description: "Registre o fundo de troco antes de confirmar pagamentos.", variant: "warning" });
      return;
    }
    if (paymentMethod === "Dinheiro" && amountReceived < selectedTotal) {
      showToast({ title: "Valor recebido insuficiente", description: "Informe o valor recebido para calcular o troco exato.", variant: "warning" });
      return;
    }
    const orderId = selectedOrder.id;
    const tableNumber = selectedOrder.orderType === "Salão" ? Number(selectedOrder.table.match(/\d+/)?.[0]) : NaN;
    const serverSessionId = operations.tables.find((table) => table.id === tableNumber)?.serverSessionId;
    let paymentRecorded = false;
    update((current) => {
      const order = current.orders.find((item) => item.id === orderId);
      if (!order || order.paymentStatus === "Pago" || !current.cashShift.isOpen) return current;

      paymentRecorded = true;
      const gross = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const couponDiscount = Math.min(gross, order.couponDiscount ?? 0);
      const manualDiscount = Math.min(gross - couponDiscount, discountType === "Percentual" ? (gross - couponDiscount) * Math.min(parsedDiscount, 100) / 100 : parsedDiscount);
      const totalDiscount = couponDiscount + manualDiscount;
      const total = gross - totalDiscount;
      return {
        ...current,
        revenue: current.revenue + total,
        paidOrderCount: current.paidOrderCount + 1,
        cashShift: {
          ...current.cashShift,
          received: { ...current.cashShift.received, [paymentMethod]: current.cashShift.received[paymentMethod] + total },
        },
        orders: current.orders.map((item) =>
          item.id === orderId
            ? { ...item, paymentStatus: "Pago", paymentMethod, discountType, discountValue: parsedDiscount, discountAmount: totalDiscount }
            : item,
        ),
        tables: order.orderType === "Salão"
          ? current.tables.map((table) => table.id === Number(order.table.match(/\d+/)?.[0])
            ? { ...table, status: "Livre" as const, openedAt: null, openedBy: null, serverSessionId: null }
            : table)
          : current.tables,
        staffAudit: [
          createStaffActivity(tenant!, {
            kind: order.orderType === "Salão" ? "table" : "order",
            title: order.orderType === "Salão" ? `Fechou Mesa ${order.table.match(/\d+/)?.[0]}` : `Recebeu pedido ${orderId}`,
            details: `${paymentMethod} · total ${brl(total)}${totalDiscount ? ` · desconto ${brl(totalDiscount)}` : ""}${paymentMethod === "Dinheiro" ? ` · troco ${brl(changeDue)}` : ""}.`,
            relatedId: orderId,
          }),
          ...current.staffAudit,
        ],
      };
    });
    if (!paymentRecorded) return;

    if (hasPublicApi() && Number.isInteger(tableNumber) && serverSessionId) {
      void fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables/${tableNumber}/close`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: serverSessionId }),
      });
    }

    printOrder(selectedOrder, "payment");

    showToast({
      title: "Pagamento confirmado",
      description: `${paymentMethod} recebido para o pedido ${orderId}. O faturamento foi atualizado.`,
      variant: "success",
    });
    setSelectedOrderId(null);
    setSelectedTableId("");
    setCashReceived("");
  }

  return (
    <AppShell tenant={tenant} title="Caixa / PDV" subtitle={`${tenant.restaurant} · pagamentos, fechamento e faturamento do dia`}>
      <PrintDevicePanel restaurant={tenant.restaurant} slug={slug} cnpj={branding.cnpj} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Faturamento do dia", brl(operations.revenue)],
          ["Pedidos pagos", String(operations.paidOrderCount)],
          ["Tickets pendentes", String(openOrders.length)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[12px] font-medium text-stone-500">{label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold">Abertura e fechamento de caixa</p>
            <p className="mt-1 text-[12px] text-stone-500">Controle de troco, sangrias e suprimentos deste turno.</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${cashShift.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>
            {cashShift.isOpen ? "Caixa aberto" : "Caixa fechado"}
          </span>
        </div>

        {!cashShift.isOpen ? (
          <form onSubmit={openShift} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-[12px] font-medium text-stone-600">
              Fundo de troco inicial (R$)
              <input
                required
                min="0"
                type="number"
                step="0.01"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-deep">Abrir caixa</button>
          </form>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Fundo inicial", brl(cashShift.openingFloat)],
                ["Sangrias", brl(withdrawalTotal)],
                ["Suprimentos", brl(supplyTotal)],
                ["Dinheiro esperado", brl(expectedCash)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-stone-50 p-3">
                  <p className="text-[11px] text-stone-500">{label}</p>
                  <p className="mt-1 text-[15px] font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <form onSubmit={registerMovement} className="grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] font-medium text-stone-500">
                  Lançamento
                  <select value={movementForm.kind} onChange={(event) => setMovementForm((current) => ({ ...current, kind: event.target.value as "Sangria" | "Suprimento" }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink">
                    <option>Sangria</option>
                    <option>Suprimento</option>
                  </select>
                </label>
                <label className="text-[11px] font-medium text-stone-500">
                  Valor (R$)
                  <input required min="0.01" step="0.01" type="number" value={movementForm.amount} onChange={(event) => setMovementForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
                </label>
                <label className="text-[11px] font-medium text-stone-500 sm:col-span-2">
                  Motivo
                  <div className="mt-1 flex gap-2">
                    <input required value={movementForm.description} onChange={(event) => setMovementForm((current) => ({ ...current, description: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
                    <button type="submit" className="shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50">Lançar</button>
                  </div>
                </label>
              </form>
              <div className="rounded-md bg-stone-50 p-3">
                <p className="text-[12px] font-semibold">Movimentações do turno</p>
                <div className="mt-2 max-h-28 space-y-1 overflow-auto">
                  {[...cashShift.supplies.map((item) => ({ ...item, kind: "Suprimento" })), ...cashShift.withdrawals.map((item) => ({ ...item, kind: "Sangria" }))].slice(-5).reverse().map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 text-[11px] text-stone-600">
                      <span className="truncate">{item.kind}: {item.description}</span><span className="shrink-0">{brl(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" onClick={closeShift} className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 hover:bg-red-100">Fechar caixa e conferir saldo</button>
          </>
        )}
        {!cashShift.isOpen && cashShift.lastClosing && (
          <p className="mt-3 text-[12px] text-stone-500">Último fechamento: {new Date(cashShift.lastClosing.closedAt).toLocaleString("pt-BR")} · dinheiro esperado {brl(cashShift.lastClosing.expectedCash)} · vendas {brl(cashShift.lastClosing.sales)}</p>
        )}
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-black/5 px-4 py-3">
          <p className="text-[13px] font-semibold">Prestação de entregas</p>
          <p className="mt-1 text-[11px] text-stone-500">Taxas e valores de pedidos recebidos pelos motoboys neste turno.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            ["Dinheiro recebido na rua", brl(deliveryCash)],
            ["PIX recebido na rua", brl(deliveryPix)],
            ["Total a prestar", brl(deliveryCash + deliveryPix)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-stone-50 p-3">
              <p className="text-[11px] text-stone-500">{label}</p>
              <p className="mt-1 text-[15px] font-semibold">{value}</p>
            </div>
          ))}
        </div>
        {operations.deliveryHistory.length > 0 && (
          <div className="divide-y divide-black/5 border-t border-black/5">
            {operations.deliveryHistory.slice().reverse().slice(0, 5).map((entry) => (
              <div key={`${entry.orderId}-${entry.completedAt}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px]">
                <span className="font-medium">{entry.orderId} · {entry.customer}</span>
                <span className="text-stone-500">Taxa {entry.method} {brl(entry.fee)}{entry.orderAmountCollected ? ` · Pedido ${entry.orderPaymentMethod} ${brl(entry.orderAmountCollected)}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {openTables.length > 0 && (
        <Card className="mt-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-end">
          <label className="block text-[12px] font-semibold text-stone-700">
            Puxar comanda de mesa aberta
            <select
              value={selectedTableId}
              onChange={(event) => {
                const tableId = event.target.value;
                setSelectedTableId(tableId);
                const order = tableOrders.find((item) => Number(item.table.match(/\d+/)?.[0]) === Number(tableId));
                setSelectedOrderId(order?.id ?? null);
                setPaymentMethod(order?.requestedPaymentMethod ?? "PIX");
                setCashReceived("");
              }}
              className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-[13px] font-normal text-ink outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Selecionar mesa...</option>
              {openTables.map((table) => (
                <option key={table.id} value={table.id}>
                  Mesa {String(table.id).padStart(2, "0")} · {table.status}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[12px] leading-relaxed text-stone-500">
            {selectedTableId
              ? `Comanda da Mesa ${selectedTableId} carregada abaixo com os itens consumidos.`
              : "Selecione uma mesa para carregar automaticamente os produtos na conferência da conta."}
          </p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="text-[13px] font-semibold">Comandas em aberto</p>
            <p className="mt-1 text-[11px] text-stone-500">Selecione um pedido para revisar e receber.</p>
          </div>
          <div className="divide-y divide-black/5">
            {openOrders.length ? openOrders.map((order) => {
              const total = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setPaymentMethod(order.requestedPaymentMethod ?? "PIX");
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50 ${selectedOrderId === order.id ? "bg-emerald-50" : ""}`}
                >
                  <span>
                    <span className="block text-[13px] font-semibold">Pedido {order.id}</span>
                    <span className="block text-[12px] text-stone-500">{order.customer} · {order.table}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold">{brl(total)}</span>
                </button>
              );
            }) : <p className="p-4 text-[13px] text-stone-500">Nenhuma comanda pendente.</p>}
          </div>
        </Card>

        <Card className="p-4">
          {selectedOrder ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Detalhamento da comanda</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Pedido {selectedOrder.id}</h2>
                  <p className="text-[12px] text-stone-500">{selectedOrder.customer} · {selectedOrder.table}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(null)} className="text-[12px] text-stone-500 hover:text-stone-800">
                  Fechar
                </button>
              </div>

              <div className="mt-4 divide-y divide-black/5 border-y border-black/5">
                {selectedOrder.items.map((item) => (
                  <div key={`${selectedOrder.id}-${item.name}`} className="flex items-center justify-between gap-3 py-3 text-[12px]">
                    <span className="text-stone-700">{item.qty}x {item.name}</span>
                    <span className="shrink-0 font-medium">{brl(item.qty * item.price)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Subtotal</span>
                <span className="text-[13px] font-semibold">{brl(selectedGross)}</span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="block text-[12px] font-medium text-stone-600">
                  Desconto
                  <select value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] text-ink">
                    <option>Percentual</option>
                    <option>Valor fixo</option>
                  </select>
                </label>
                <label className="block text-[12px] font-medium text-stone-600">
                  {discountType === "Percentual" ? "Desconto (%)" : "Desconto (R$)"}
                  <input min="0" max={discountType === "Percentual" ? 100 : undefined} step="0.01" type="number" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] text-ink" />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-stone-600">
                <span>Desconto aplicado</span><span>- {brl(selectedDiscount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-3">
                <span className="text-[13px] font-semibold">Total a receber</span>
                <span className="font-display text-xl font-semibold">{brl(selectedTotal)}</span>
              </div>

              <button type="button" onClick={() => printOrder(selectedOrder, "kitchen")} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50">
                <Printer className="size-4" /> Imprimir Comanda
              </button>

              <label className="mt-4 block text-[12px] font-medium text-stone-600">
                Forma de pagamento
                <select
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value as PaymentMethod);
                    setCashReceived("");
                  }}
                  className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <option value="PIX">PIX</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </label>
              {paymentMethod === "Dinheiro" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-[12px] font-medium text-stone-600">
                    Valor recebido (R$)
                    <input
                      type="number"
                      min={selectedTotal}
                      step="0.01"
                      value={cashReceived}
                      onChange={(event) => setCashReceived(event.target.value)}
                      className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </label>
                  <div className="rounded-md bg-emerald-50 p-3">
                    <p className="text-[11px] font-medium text-emerald-800">Troco</p>
                    <p className="mt-1 font-display text-lg font-semibold text-emerald-800">{brl(changeDue)}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={payOrder}
                disabled={!cashShift.isOpen || (paymentMethod === "Dinheiro" && amountReceived < selectedTotal)}
                className="mt-3 w-full rounded-md bg-brand px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                Confirmar Pagamento
              </button>
            </>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <p className="text-[13px] font-semibold">Nenhuma comanda selecionada</p>
              <p className="mt-1 max-w-xs text-[12px] text-stone-500">Escolha uma comanda em aberto para conferir os itens e registrar o pagamento.</p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
