import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { PrintDevicePanel } from "@/components/print-device-panel";
import { brl, type MenuItem } from "@/lib/mock";
import { api, getToken, type ApiSession } from "@/lib/api";
import { useTenantMenu } from "@/lib/menu-store";
import { createStaffActivity, useTenantOperations, type PaymentMethod } from "@/lib/operations";
import { printThermalReceipt, useThermalPaperWidth } from "@/lib/thermal-print";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

type SaleLine = { product: MenuItem; quantity: number };

export const Route = createFileRoute("/pdv")({
  head: () => ({ meta: [{ title: "PDV do restaurante — RestauranteAI" }, { name: "description", content: "RestauranteAI — pdv do restaurante." }, { property: "og:title", content: "PDV do restaurante — RestauranteAI" }, { property: "og:description", content: "RestauranteAI — pdv do restaurante." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: CounterPdv });

function CounterPdv() {
  const { tenant, loading } = useRequireTenant(["caixa", "owner"]);
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { items: menuItems } = useTenantMenu(slug);
  const { operations, update } = useTenantOperations(slug);
  const { branding } = useTenantBranding(slug);
  const { paperWidth } = useThermalPaperWidth(slug);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Dinheiro");
  const [manualPaymentConfirmed, setManualPaymentConfirmed] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [channel, setChannel] = useState<"Balcão" | "Salão">("Balcão");
  const [tableSessions, setTableSessions] = useState<ApiSession[]>([]);
  const [tableSessionError, setTableSessionError] = useState("");
  const [confirmedSessionPayments, setConfirmedSessionPayments] = useState<Record<number, boolean>>({});
  const [sessionPaymentMethods, setSessionPaymentMethods] = useState<Record<number, "dinheiro" | "pix" | "cartao" | "outros">>({});
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const alertedSessions = useRef(new Set<number>());
  const hasBackendSession = Boolean(getToken());

  useEffect(() => {
    if (!hasBackendSession) return;
    let active = true;
    const refreshSessions = async () => {
      try {
        const sessions = await api.listOpenSessions();
        if (active) {
          setTableSessions(sessions);
          setTableSessionError("");
        }
      } catch (error) {
        if (active) setTableSessionError(error instanceof Error ? error.message : "Não foi possível carregar as comandas abertas.");
      }
    };
    void refreshSessions();
    const interval = window.setInterval(() => void refreshSessions(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [hasBackendSession]);

  useEffect(() => {
    const requested = tableSessions.filter((session) => session.closeRequestedAt);
    const requestedIds = new Set(requested.map((session) => session.sessionId));
    for (const id of alertedSessions.current) {
      if (!requestedIds.has(id)) alertedSessions.current.delete(id);
    }
    if (!alertSoundEnabled) return;
    for (const session of requested) {
      if (alertedSessions.current.has(session.sessionId)) continue;
      alertedSessions.current.add(session.sessionId);
      const context = audioContext.current;
      if (!context || context.state !== "running") continue;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.12;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.22);
    }
  }, [alertSoundEnabled, tableSessions]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const products = menuItems.filter((item) => item.available);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const results = products.filter((item) =>
    `${item.id} ${item.name} ${item.category} ${item.description}`.toLocaleLowerCase("pt-BR").includes(query),
  );
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const tendered = Number(cashReceived.replace(",", ".")) || 0;
  const change = paymentMethod === "Dinheiro" ? Math.max(0, tendered - subtotal) : 0;

  function addProduct(product: MenuItem) {
    setManualPaymentConfirmed(false);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, amount: number) {
    setManualPaymentConfirmed(false);
    setCart((current) => current
      .map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + amount } : line)
      .filter((line) => line.quantity > 0));
  }

    async function closeTableSession(session: ApiSession) {
      const confirmed = confirmedSessionPayments[session.sessionId];
      if (!confirmed) {
        showToast({ title: "Confirme o recebimento", description: "Confirme que o pagamento foi recebido antes de encerrar a comanda.", variant: "warning" });
        return;
      }
      try {
        const method = sessionPaymentMethods[session.sessionId] ?? "pix";
        await api.closeSession(session.sessionId, method);
        setTableSessions((current) => current.filter((entry) => entry.sessionId !== session.sessionId));
        showToast({ title: "Comanda encerrada", description: `${session.tableLabel} foi fechada no servidor.`, variant: "success" });
      } catch (error) {
        showToast({ title: "Não foi possível encerrar a comanda", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
      }
    }

    async function enableAlertSound() {
      const context = new AudioContext();
      await context.resume();
      audioContext.current = context;
      setAlertSoundEnabled(true);
    }
  function finishSale() {
    if (!cart.length) return;
    if (!operations.cashShift.isOpen) {
      showToast({ title: "Caixa fechado", description: "Abra o turno antes de registrar uma venda.", variant: "warning" });
      return;
    }

    if (paymentMethod === "Dinheiro" && tendered < subtotal) {
      showToast({ title: "Valor insuficiente", description: "Informe o valor recebido para calcular o troco.", variant: "warning" });
      return;
    }
    if (paymentMethod !== "Dinheiro" && !manualPaymentConfirmed) {
      showToast({ title: "Confirme o recebimento", description: "Verifique o pagamento no aplicativo ou na maquininha antes de registrar a venda.", variant: "warning" });
      return;
    }

    if (!tenant) return;
    const orderId = `PDV-${Date.now().toString().slice(-7)}`;
    const saleTotal = subtotal;
    const saleLines = cart.map((line) => ({ ...line }));
    let recorded = false;
    update((current) => {
      if (!current.cashShift.isOpen) return current;
      recorded = true;
      return {
        ...current,
        revenue: current.revenue + saleTotal,
        paidOrderCount: current.paidOrderCount + 1,
        cashShift: {
          ...current.cashShift,
          received: { ...current.cashShift.received, [paymentMethod]: current.cashShift.received[paymentMethod] + saleTotal },
        },
        orders: [
          {
            id: orderId,
            customer: `Venda ${channel.toLowerCase()}`,
            table: channel,
            address: channel === "Salão" ? "Consumo no salão" : "Retirada no balcão",
            eta: "Imediato",
            items: saleLines.map((line) => ({ name: line.product.name, qty: line.quantity, price: line.product.price })),
            kitchenStatus: "Pendente",
            paymentStatus: "Pago",
            paymentMethod,
            deliveryStatus: "Entregue",
            orderType: channel,
            waitMinutes: 0,
            neighborhood: "Centro",
            distanceKm: 0,
          },
          ...current.orders,
        ],
        staffAudit: [createStaffActivity(tenant, {
          kind: channel === "Salão" ? "table" : "order",
          title: channel === "Salão" ? "Registrou venda de salão" : "Registrou venda de balcão",
          details: `${paymentMethod} · ${brl(saleTotal)}${paymentMethod === "Dinheiro" ? ` · troco ${brl(change)}` : ""}.`,
          relatedId: orderId,
        }), ...current.staffAudit],
      };
    });
    if (!recorded) {
      showToast({ title: "Caixa fechado", description: "O turno foi encerrado em outra tela. Reabra o caixa para continuar.", variant: "warning" });
      return;
    }

    setCart([]);
    setCashReceived("");
    setManualPaymentConfirmed(false);
    const printed = printThermalReceipt({
      kind: "sale",
      restaurant: tenant.restaurant,
      cnpj: branding.cnpj,
      documentId: orderId,
      customer: `Venda ${channel.toLowerCase()}`,
      table: channel,
      operator: tenant.name,
      items: saleLines.map((line) => ({ name: line.product.name, quantity: line.quantity, unitPrice: line.product.price })),
      subtotal: saleTotal,
      total: saleTotal,
      paymentMethod,
      amountReceived: paymentMethod === "Dinheiro" ? tendered : undefined,
      change: paymentMethod === "Dinheiro" ? change : undefined,
    }, paperWidth);
    if (!printed) showToast({ title: "Pop-up bloqueado", description: "A venda foi registrada. Permita pop-ups para imprimir o recibo.", variant: "warning" });
    showToast({ title: "Venda registrada", description: `Pedido ${orderId} enviado para a cozinha.`, variant: "success" });
  }

  return (
    <AppShell
      tenant={tenant}
      title="PDV de balcão"
      subtitle={`${tenant.restaurant} · terminal de venda presencial`}
      action={<Link to="/caixa" className="rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50">Ver caixa</Link>}
    >
      {hasBackendSession && <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-[13px] font-semibold"><BellRing className="size-4 text-brand" />Comandas abertas · {tableSessions.length}</h2><p className="mt-1 text-[11px] text-stone-500">Solicitações de fechamento aparecem aqui automaticamente.</p></div>
          <button type="button" onClick={() => void enableAlertSound().catch((error: unknown) => setTableSessionError(error instanceof Error ? error.message : "O navegador bloqueou o áudio."))} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[10px] font-semibold text-stone-700">{alertSoundEnabled ? "Som ativado" : "Ativar som de alerta"}</button>
        </div>
        {tableSessionError && <p role="alert" className="mt-3 rounded-md bg-rose-50 p-2 text-[11px] text-rose-700">{tableSessionError}</p>}
        {tableSessions.length > 0 && <div className="mt-3 space-y-2">
          {tableSessions.map((session) => (
            <article key={session.sessionId} className={`rounded-md border p-3 ${session.closeRequestedAt ? "border-amber-300 bg-amber-50" : "border-black/5 bg-stone-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-[12px] font-semibold">{session.tableLabel} · {brl(session.total)}</p><p className="mt-1 text-[10px] text-stone-600">{session.orders.length} pedido(s){session.closeRequestedAt ? " · SOLICITOU FECHAMENTO" : ""}</p></div>
                {session.closeRequestedAt && <span className="rounded-full bg-amber-200 px-2 py-1 text-[9px] font-bold uppercase text-amber-900">Atender mesa</span>}
              </div>
              <div className="mt-3 space-y-1">{session.orders.map((order) => <p key={order.id} className="text-[10px] text-stone-600">#{order.id} · {order.orderDetails} · {order.status}{order.paymentMethod ? ` · ${order.paymentMethod}` : ""}</p>)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select aria-label={`Forma de pagamento da ${session.tableLabel}`} value={sessionPaymentMethods[session.sessionId] ?? "pix"} onChange={(event) => { setSessionPaymentMethods((current) => ({ ...current, [session.sessionId]: event.target.value as "dinheiro" | "pix" | "cartao" | "outros" })); setConfirmedSessionPayments((current) => ({ ...current, [session.sessionId]: false })); }} className="rounded border border-black/10 bg-white px-2 py-1.5 text-[10px]"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="outros">Outro</option></select>
                <label className="flex items-center gap-1.5 text-[10px] text-stone-600"><input type="checkbox" checked={Boolean(confirmedSessionPayments[session.sessionId])} onChange={(event) => setConfirmedSessionPayments((current) => ({ ...current, [session.sessionId]: event.target.checked }))} />Pagamento recebido</label>
                <button type="button" onClick={() => void closeTableSession(session)} className="ml-auto rounded-md bg-brand px-3 py-1.5 text-[10px] font-semibold text-white">Encerrar comanda</button>
              </div>
            </article>
          ))}
        </div>}
      </Card>}
      <PrintDevicePanel restaurant={tenant.restaurant} slug={slug} cnpj={branding.cnpj} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/5 bg-white p-3">
        <div>
          <p className="text-[12px] font-semibold">Turno do caixa</p>
          <p className="text-[11px] text-stone-500">{operations.cashShift.isOpen ? "Aberto e pronto para registrar vendas." : "Abra o caixa antes de concluir uma venda."}</p>
        </div>
        {operations.cashShift.isOpen
          ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">Aberto</span>
          : <Link to="/caixa" className="rounded-md bg-brand px-3 py-2 text-[11px] font-semibold text-white">Abrir caixa</Link>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <div className="border-b border-black/5 p-4">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código ou nome do item" className="w-full rounded-md bg-stone-50 py-2.5 pl-9 pr-3 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30" />
            </label>
          </div>
          <div className="grid max-h-[68vh] gap-3 overflow-y-auto p-4 sm:grid-cols-2 2xl:grid-cols-3">
            {results.map((product) => (
              <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex min-h-28 flex-col items-start justify-between rounded-md border border-black/5 bg-white p-3 text-left transition hover:border-brand/40 hover:bg-emerald-50/40">
                <span>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-stone-400">Código {product.id} · {product.category}</span>
                  <span className="mt-1 block text-[13px] font-semibold">{product.name}</span>
                  <span className="mt-1 line-clamp-2 block text-[11px] text-stone-500">{product.description}</span>
                </span>
                <span className="mt-3 flex w-full items-center justify-between"><span className="text-[13px] font-semibold text-brand">{brl(product.price)}</span><Plus className="size-4 text-brand" /></span>
              </button>
            ))}
            {!results.length && <p className="p-4 text-[13px] text-stone-500">Nenhum item ativo corresponde à busca.</p>}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div><p className="text-[13px] font-semibold">Venda atual</p><p className="text-[11px] text-stone-500">{cart.reduce((sum, line) => sum + line.quantity, 0)} itens</p></div>
            {cart.length > 0 && <button type="button" onClick={() => { setCart([]); setManualPaymentConfirmed(false); }} className="rounded-md p-2 text-stone-500 hover:bg-red-50 hover:text-red-600" aria-label="Limpar venda"><Trash2 className="size-4" /></button>}
          </div>
          <div className="flex-1 space-y-3 p-4">
            {cart.map((line) => (
              <div key={line.product.id} className="border-b border-black/5 pb-3">
                <div className="flex justify-between gap-2 text-[12px]"><span className="font-medium">{line.product.name}</span><span className="font-semibold">{brl(line.product.price * line.quantity)}</span></div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-stone-500">{brl(line.product.price)} un.</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => changeQuantity(line.product.id, -1)} className="grid size-7 place-items-center rounded border border-black/10 hover:bg-stone-50" aria-label={`Remover uma unidade de ${line.product.name}`}><Minus className="size-3.5" /></button>
                    <span className="min-w-5 text-center text-[12px] font-semibold">{line.quantity}</span>
                    <button type="button" onClick={() => changeQuantity(line.product.id, 1)} className="grid size-7 place-items-center rounded border border-black/10 hover:bg-stone-50" aria-label={`Adicionar uma unidade de ${line.product.name}`}><Plus className="size-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            {!cart.length && <p className="py-8 text-center text-[12px] text-stone-500">Pesquise ou selecione um produto para iniciar a venda.</p>}

            <label className="block text-[11px] font-medium text-stone-500">Venda para
              <select value={channel} onChange={(event) => setChannel(event.target.value as "Balcão" | "Salão")} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"><option>Balcão</option><option>Salão</option></select>
            </label>
            <label className="block text-[11px] font-medium text-stone-500">Forma de pagamento · registro manual
              <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value as PaymentMethod); setManualPaymentConfirmed(false); }} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"><option>Dinheiro</option><option>PIX</option><option>Cartão</option></select>
            </label>
            {paymentMethod === "Dinheiro" ? (
              <label className="block text-[11px] font-medium text-stone-500">Valor recebido em dinheiro (confirmação manual, R$)
                <input min={subtotal} step="0.01" type="number" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
              </label>
            ) : (
              <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <input type="checkbox" checked={manualPaymentConfirmed} onChange={(event) => setManualPaymentConfirmed(event.target.checked)} className="mt-0.5 accent-amber-700" />
                <span>Confirmo que verifiquei o recebimento de {paymentMethod} fora do sistema. Não há integração automática de pagamento.</span>
              </label>
            )}
            <div className="space-y-2 border-t border-black/5 pt-3 text-[12px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              {paymentMethod === "Dinheiro" && <div className="flex justify-between text-stone-500"><span>Troco</span><span>{brl(change)}</span></div>}
              <div className="flex justify-between text-[15px] font-semibold"><span>Total</span><span className="text-brand">{brl(subtotal)}</span></div>
            </div>
            <button type="button" onClick={finishSale} disabled={!cart.length || !operations.cashShift.isOpen || (paymentMethod === "Dinheiro" ? tendered < subtotal : !manualPaymentConfirmed)} className="flex w-full items-center justify-center rounded-md bg-brand px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-stone-300"><Printer className="mr-2 size-4" />Registrar venda e imprimir recibo</button>
            {paymentMethod === "Dinheiro" && tendered > 0 && tendered < subtotal && <p className="text-[11px] text-red-600">O valor recebido é menor que o total da venda.</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
