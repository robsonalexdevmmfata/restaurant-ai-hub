import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { brl, type MenuItem } from "@/lib/mock";
import { dispatchAbandonedCartCouponReminder } from "@/lib/delivery-notifications";
import { useTenantCoupons, updateTenantCoupons, validateCoupon } from "@/lib/coupon-store";
import { useTenantMenu } from "@/lib/menu-store";
import { updateTenantOperations, useTenantOperations } from "@/lib/operations";
import { hasPublicApi, publicApiUrl } from "@/lib/public-api";
import { useTenantBranding } from "@/lib/tenant-branding";

type CartLine = { item: MenuItem; quantity: number };

export const Route = createFileRoute("/m/$slug/mesa/$numero")({ component: PublicTableMenu });

function PublicTableMenu() {
  const { slug, numero } = Route.useParams();
  const tableNumber = Number(numero);
  const { items } = useTenantMenu(slug);
    const { coupons } = useTenantCoupons(slug);
  const { branding } = useTenantBranding(slug);
  const { operations } = useTenantOperations(slug);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [restaurantName, setRestaurantName] = useState(() => slug === "pizzaria-vulcao" ? "Pizzaria Vulcão" : slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "));

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hasPublicApi()) return;
    void fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables`))
      .then(async (response) => response.ok ? response.json() as Promise<{ restaurantName?: string }> : null)
      .then((payload) => { if (payload?.restaurantName) setRestaurantName(payload.restaurantName); })
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    if (!hydrated || !Number.isInteger(tableNumber) || tableNumber < 1) return;
    let active = true;
    const openSession = async () => {
      let serverSessionId: string | null = null;
      if (hasPublicApi()) {
        try {
          const response = await fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables/${tableNumber}/open`), { method: "POST" });
          if (response.ok) {
            const payload = await response.json() as { session?: { sessionId?: string } };
            serverSessionId = payload.session?.sessionId ?? null;
          }
        } catch {
          // Continue with local demo state when the backend is not reachable.
        }
      }
      if (!active) return;
      const openedAt = new Date().toISOString();
      updateTenantOperations(slug, (current) => ({
        ...current,
        tables: current.tables.map((table) => table.id === tableNumber
          ? { ...table, status: table.status === "Livre" ? "Ocupada" : table.status, openedAt: table.openedAt ?? openedAt, openedBy: table.openedBy ?? "Cliente via QR", serverSessionId: serverSessionId ?? table.serverSessionId }
          : table),
      }));
    };
    void openSession();
    return () => { active = false; };
  }, [hydrated, slug, tableNumber]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${slug} · Mesa ${numero}`;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousFavicon = favicon?.href;
    if (favicon && branding.faviconUrl) favicon.href = branding.faviconUrl;
    return () => {
      document.title = previousTitle;
      if (favicon && previousFavicon) favicon.href = previousFavicon;
    };
  }, [branding.faviconUrl, numero, slug]);

  const availableItems = items.filter((item) => item.available);
  const categories = [...new Set(availableItems.map((item) => item.category))];
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0), [cart]);
  const couponPreview = validateCoupon(coupons, couponDraft, total, 0, false);
  const appliedCoupon = validateCoupon(coupons, appliedCouponCode, total, 0, false);
  const couponDiscount = appliedCoupon.valid ? appliedCoupon.discountAmount : 0;
  const finalTotal = Math.max(0, total - couponDiscount);

    useEffect(() => {
      if (!cart.length || !customerPhone.trim() || reminderSent) return;
      const incentive = coupons.find((coupon) => validateCoupon([coupon], coupon.code, total, 0, false).valid);
      if (!incentive) return;
      const timer = window.setTimeout(() => {
        void dispatchAbandonedCartCouponReminder(slug, customerPhone, customerName, incentive.code, finalTotal)
          .then((result) => {
            setReminderSent(true);
            if (result.status === "simulated" || result.status === "sent") {
              setNotice(`Lembrete ${result.status === "sent" ? "enviado" : "simulado"} com o cupom ${incentive.code}.`);
            }
          });
      }, 2 * 60 * 1000);
      return () => window.clearTimeout(timer);
    }, [appliedCouponCode, cart, coupons, customerName, customerPhone, finalTotal, reminderSent, slug, total]);
  const tableStatus = operations.tables.find((table) => table.id === tableNumber)?.status ?? "Ocupada";

  function addItem(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      return existing
        ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { item, quantity: 1 }];
    });
      setReminderSent(false);
    setNotice("");
  }

  function changeQuantity(itemId: string, delta: number) {
    setCart((current) => current.map((line) => line.item.id === itemId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
    setReminderSent(false);
  }

  function applyCoupon() {
    if (!couponPreview.valid || !couponPreview.coupon) {
      setAppliedCouponCode("");
      return;
    }
    setAppliedCouponCode(couponPreview.coupon.code);
    setReminderSent(false);
  }

  function sendOrder() {
    if (!cart.length) return;
    const currentCoupon = appliedCouponCode ? validateCoupon(coupons, appliedCouponCode, total, 0, false) : null;
    if (appliedCouponCode && !currentCoupon?.valid) {
      setAppliedCouponCode("");
      setNotice(currentCoupon?.error ?? "Este cupom não é mais válido.");
      return;
    }
    if (currentCoupon?.coupon) {
      let redeemed = false;
      updateTenantCoupons(slug, (current) => current.map((coupon) => {
        if (coupon.id !== currentCoupon.coupon!.id || !coupon.active || (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) || Date.now() < new Date(coupon.startsAt).getTime() || Date.now() > new Date(coupon.expiresAt).getTime()) return coupon;
        redeemed = true;
        return { ...coupon, usedCount: coupon.usedCount + 1 };
      }));
      if (!redeemed) {
        setAppliedCouponCode("");
        setNotice("Este cupom atingiu o limite de usos. Revise o código antes de enviar.");
        return;
      }
    }
    const orderId = `M${tableNumber}-${Date.now().toString().slice(-6)}`;
    const customer = customerName.trim() || `Mesa ${tableNumber}`;
    updateTenantOperations(slug, (current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === tableNumber
        ? { ...table, status: "Comanda Aberta", openedAt: table.openedAt ?? new Date().toISOString(), openedBy: table.openedBy ?? customer }
        : table),
      orders: [
        {
          id: orderId,
          customer,
          table: `Mesa ${tableNumber}`,
          address: "Consumo no salão",
          eta: "20 min",
          items: cart.map((line) => ({ name: line.item.name, qty: line.quantity, price: line.item.price })),
          kitchenStatus: "Pendente",
          paymentStatus: "Pendente",
                    couponCode: currentCoupon?.coupon?.code,
                    couponDiscount: currentCoupon?.discountAmount ?? 0,
                    discountAmount: currentCoupon?.discountAmount ?? 0,
                    deliveryFee: 0,
          deliveryStatus: "Entregue",
          orderType: "Salão",
          waitMinutes: 0,
          neighborhood: "Salão",
          distanceKm: 0,
        },
        ...current.orders,
      ],
    }));
    setCart([]);
    setCartOpen(false);
    setAppliedCouponCode("");
    setNotice(`Pedido enviado à cozinha. Número ${orderId}.`);
  }

  if (!hydrated || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 100) {
    return <main className="grid min-h-screen place-items-center bg-stone-50 p-6 text-[13px] text-stone-500">Carregando cardápio...</main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-28 text-ink">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {branding.logoUrl ? <img src={branding.logoUrl} alt={restaurantName} className="size-12 rounded-md object-contain" /> : <span className="grid size-12 place-items-center rounded-md bg-stone-100 font-display text-lg font-bold" style={{ color: branding.primaryColor }}>{restaurantName.charAt(0)}</span>}
          <div className="min-w-0 flex-1"><h1 className="truncate font-display text-lg font-semibold">{restaurantName}</h1><p className="text-[11px] text-stone-500">Cardápio digital · Mesa {tableNumber}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${tableStatus === "Livre" ? "bg-stone-100 text-stone-500" : "bg-emerald-50 text-emerald-700"}`}>{tableStatus}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {notice && <div role="status" className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-medium text-emerald-800">{notice}</div>}
        <section className="mb-6 rounded-lg p-5 text-white" style={{ backgroundColor: branding.primaryColor }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">Bem-vindo à mesa {tableNumber}</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Escolha algo para aproveitar.</h2>
          <p className="mt-1 text-[12px] text-white/80">Seu pedido será enviado direto para a cozinha. Consumo no salão, sem taxa de entrega.</p>
        </section>

        <label className="mb-7 block text-[11px] font-medium text-stone-500">Nome para identificar o pedido (opcional)
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Como podemos chamar você?" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-[13px] text-ink" />
        </label>
        <label className="-mt-5 mb-7 block text-[11px] font-medium text-stone-500">WhatsApp para atualizações e ofertas (opcional)
          <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} inputMode="tel" placeholder="+55 11 99999-0000" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-[13px] text-ink" />
        </label>

        {categories.length ? categories.map((category) => (
          <section key={category} className="mb-8">
            <h2 className="mb-3 border-b border-black/10 pb-2 font-display text-base font-semibold">{category}</h2>
            <div className="space-y-3">
              {availableItems.filter((item) => item.category === category).map((item) => {
                const quantity = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                return (
                  <article key={item.id} className="overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm">
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[160px_minmax(0,1fr)]">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full min-h-32 w-full object-cover" /> : <div className="grid min-h-32 place-items-center bg-stone-100 text-stone-400"><Utensils className="size-6" /></div>}
                      <div className="flex min-w-0 flex-col p-3 sm:p-4">
                        <h3 className="text-[13px] font-semibold">{item.name}</h3>
                        <p className="mt-1 flex-1 text-[11px] leading-relaxed text-stone-500">{item.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold" style={{ color: branding.primaryColor }}>{brl(item.price)}</span>
                          {quantity ? (
                            <div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Remover ${item.name}`} className="grid size-8 place-items-center rounded-md border border-black/10 text-stone-700"><Minus className="size-4" /></button><span className="min-w-5 text-center text-[12px] font-semibold">{quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Adicionar ${item.name}`} className="grid size-8 place-items-center rounded-md text-white" style={{ backgroundColor: branding.primaryColor }}><Plus className="size-4" /></button></div>
                          ) : <button type="button" onClick={() => addItem(item)} className="rounded-md px-3 py-2 text-[11px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Adicionar</button>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )) : <div className="rounded-lg border border-black/5 bg-white p-8 text-center text-[13px] text-stone-500">O cardápio está sendo atualizado.</div>}
      </div>

      {cart.length > 0 && <>
        {cartOpen && <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={() => setCartOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Seu pedido" className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 sm:max-w-md sm:rounded-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Seu pedido</h2><p className="text-[11px] text-stone-500">Mesa {tableNumber}</p></div><button type="button" onClick={() => setCartOpen(false)} className="text-[12px] text-stone-500">Fechar</button></div>
            <div className="mt-4 divide-y divide-black/5">{cart.map((line) => <div key={line.item.id} className="flex items-center justify-between gap-3 py-3 text-[12px]"><span>{line.quantity}x {line.item.name}</span><span className="font-semibold">{brl(line.quantity * line.item.price)}</span></div>)}</div>
            <div className="mt-4 rounded-md bg-stone-50 p-3">
              <label className="block text-[11px] font-semibold text-stone-600">Aplicar cupom de desconto
                <div className="mt-1.5 flex gap-2">
                  <input value={couponDraft} onChange={(event) => { setCouponDraft(event.target.value.toUpperCase()); setAppliedCouponCode(""); }} placeholder="Ex.: BEMVINDO10" className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-mono" />
                  <button type="button" disabled={!couponPreview.valid} onClick={applyCoupon} className="rounded-md px-3 py-2 text-[11px] font-semibold text-white disabled:bg-stone-300" style={{ backgroundColor: couponPreview.valid ? branding.primaryColor : undefined }}>Aplicar</button>
                </div>
              </label>
              {couponDraft.trim() && <p className={`mt-2 text-[10px] ${couponPreview.valid ? "text-emerald-700" : "text-rose-600"}`}>{couponPreview.valid ? `Cupom válido · ${brl(couponPreview.discountAmount)} de desconto${couponPreview.coupon?.kind === "frete-gratis" ? " no frete" : ""}.` : couponPreview.error}</p>}
              {appliedCoupon.valid && <p className="mt-1 text-[10px] font-medium text-emerald-700">Cupom {appliedCoupon.coupon?.code} aplicado.</p>}
            </div>
            <div className="mt-3 space-y-2 border-t border-black/5 pt-3 text-[12px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(total)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Desconto {appliedCoupon.coupon?.code}</span><span>- {brl(couponDiscount)}</span></div>}
              <div className="flex justify-between border-t border-black/5 pt-2 text-[14px] font-semibold"><span>Total</span><span style={{ color: branding.primaryColor }}>{brl(finalTotal)}</span></div>
            </div>
            <button type="button" onClick={sendOrder} className="mt-4 w-full rounded-md py-3 text-[12px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Enviar pedido à cozinha</button>
          </section>
        </div>}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3"><button type="button" onClick={() => setCartOpen(true)} className="flex min-h-12 flex-1 items-center justify-between rounded-md px-4 text-white" style={{ backgroundColor: branding.primaryColor }}><span className="flex items-center gap-2 text-[12px] font-semibold"><ShoppingBag className="size-4" />Ver pedido · {cart.reduce((sum, line) => sum + line.quantity, 0)} itens</span><span className="text-[13px] font-bold">{brl(total)}</span></button></div>
        </div>
      </>}
    </main>
  );
}
