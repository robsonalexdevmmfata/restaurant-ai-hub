import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Minus, PackageCheck, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { brl, type MenuItem } from "@/lib/mock";
import { dispatchAbandonedCartCouponReminder } from "@/lib/delivery-notifications";
import { useTenantCoupons, updateTenantCoupons, validateCoupon } from "@/lib/coupon-store";
import { distanceBetweenKm, geocodeBrazilPostalCode } from "@/lib/delivery-routing";
import { useTenantMenu } from "@/lib/menu-store";
import { calculateDeliveryFee, updateTenantOperations, useTenantOperations } from "@/lib/operations";
import { useTenantBranding } from "@/lib/tenant-branding";

type DeliveryCartLine = { item: MenuItem; quantity: number };

export const Route = createFileRoute("/cardapio/$slug")({ component: PublicMenu });

function PublicMenu() {
  const { slug } = Route.useParams();
  const { items } = useTenantMenu(slug);
  const { branding } = useTenantBranding(slug);
  const { coupons } = useTenantCoupons(slug);
  const { operations } = useTenantOperations(slug);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [neighborhood, setNeighborhood] = useState(branding.deliveryFees.neighborhoodFees[0]?.neighborhood ?? "Centro");
  const [distanceKm, setDistanceKm] = useState(2);
  const [geocoding, setGeocoding] = useState(false);
  const [cart, setCart] = useState<DeliveryCartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [orderNotice, setOrderNotice] = useState("");
  const [reminderSent, setReminderSent] = useState(false);
  const restaurantName = slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const availableItems = items.filter((item) => item.available);
  const categories = [...new Set(availableItems.map((item) => item.category))];
  const deliveryFee = calculateDeliveryFee(neighborhood, distanceKm, branding.deliveryFees);
  const subtotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const couponPreview = validateCoupon(coupons, couponDraft, subtotal, deliveryFee, true);
  const appliedCoupon = validateCoupon(coupons, appliedCouponCode, subtotal, deliveryFee, true);
  const couponDiscount = appliedCoupon.valid ? appliedCoupon.discountAmount : 0;
  const orderTotal = Math.max(0, subtotal + deliveryFee - couponDiscount);

  function addItem(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      return existing
        ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { item, quantity: 1 }];
    });
    setReminderSent(false);
    setOrderNotice("");
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

  function submitDeliveryOrder() {
    if (!cart.length || !deliveryAddress.trim()) {
      setOrderNotice("Adicione itens e informe o endereço de entrega.");
      return;
    }
    const coupon = appliedCouponCode ? validateCoupon(coupons, appliedCouponCode, subtotal, deliveryFee, true) : null;
    if (appliedCouponCode && !coupon?.valid) {
      setAppliedCouponCode("");
      setOrderNotice(coupon?.error ?? "O cupom não está mais disponível.");
      return;
    }
    if (coupon?.coupon) {
      let redeemed = false;
      updateTenantCoupons(slug, (current) => current.map((item) => {
        if (item.id !== coupon.coupon!.id || !item.active || (item.maxUses > 0 && item.usedCount >= item.maxUses) || Date.now() < new Date(item.startsAt).getTime() || Date.now() > new Date(item.expiresAt).getTime()) return item;
        redeemed = true;
        return { ...item, usedCount: item.usedCount + 1 };
      }));
      if (!redeemed) {
        setAppliedCouponCode("");
        setOrderNotice("O limite de uso deste cupom foi atingido.");
        return;
      }
    }

    const orderId = `WEB-${Date.now().toString().slice(-7)}`;
    updateTenantOperations(slug, (current) => ({
      ...current,
      orders: [{
        id: orderId,
        customer: restaurantName,
        customerPhone: customerPhone.trim(),
        table: "Delivery",
        address: deliveryAddress.trim(),
        eta: "35 min",
        items: cart.map((line) => ({ name: line.item.name, qty: line.quantity, price: line.item.price })),
        kitchenStatus: "Pendente",
        paymentStatus: "Pendente",
        requestedPaymentMethod: paymentMethod,
        deliveryStatus: "Disponível",
        orderType: "Delivery / WhatsApp",
        waitMinutes: 0,
        neighborhood,
        distanceKm,
        postalCode,
        deliveryFee,
        couponCode: coupon?.coupon?.code,
        couponDiscount: coupon?.discountAmount ?? 0,
        discountAmount: coupon?.discountAmount ?? 0,
        trackingToken: crypto.randomUUID(),
        routeProgress: 0,
      }, ...current.orders],
    }));
    setOrderNotice(`Pedido ${orderId} enviado. Você pode acompanhar a confirmação pelo WhatsApp.`);
    setCart([]);
    setCartOpen(false);
    setAppliedCouponCode("");
  }

  useEffect(() => {
    if (!cart.length || !customerPhone.trim() || reminderSent) return;
    const incentive = coupons.find((coupon) => validateCoupon([coupon], coupon.code, subtotal, deliveryFee, true).valid);
    if (!incentive) return;
    const timer = window.setTimeout(() => {
      void dispatchAbandonedCartCouponReminder(slug, customerPhone, restaurantName, incentive.code, orderTotal)
        .then((result) => {
          setReminderSent(true);
          if (result.status === "sent" || result.status === "simulated") setOrderNotice(`Lembrete ${result.status === "sent" ? "enviado" : "simulado"} com ${incentive.code}.`);
        });
    }, 2 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [cart.length, coupons, customerPhone, deliveryFee, orderTotal, reminderSent, restaurantName, slug, subtotal]);

  async function locatePostalCode() {
    setGeocoding(true);
    const point = await geocodeBrazilPostalCode(postalCode);
    setGeocoding(false);
    if (!point) return;
    const distance = distanceBetweenKm(operations.deliveryOrigin, point);
    setDistanceKm(Math.round(distance * 100) / 100);
  }

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${restaurantName} · Cardápio`;
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    const previousFavicon = favicon.href;
    if (branding.faviconUrl) favicon.href = branding.faviconUrl;
    return () => {
      document.title = previousTitle;
      if (favicon && previousFavicon) favicon.href = previousFavicon;
    };
  }, [branding.faviconUrl, restaurantName]);

  useEffect(() => {
    if (branding.deliveryFees.model !== "bairro") return;
    const firstNeighborhood = branding.deliveryFees.neighborhoodFees[0]?.neighborhood;
    if (firstNeighborhood && !branding.deliveryFees.neighborhoodFees.some((rule) => rule.neighborhood === neighborhood)) {
      setNeighborhood(firstNeighborhood);
    }
  }, [branding.deliveryFees.model, branding.deliveryFees.neighborhoodFees, neighborhood]);

  return (
    <main className="min-h-screen bg-stone-50 text-ink" style={{ "--menu-brand": branding.primaryColor } as CSSProperties}>
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5 sm:px-6">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={`Logo ${restaurantName}`} className="size-12 rounded-md object-contain" />
          ) : (
            <span className="grid size-12 place-items-center rounded-md bg-stone-100 font-display text-lg font-bold" style={{ color: branding.primaryColor }}>
              {restaurantName.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold">{restaurantName}</h1>
            <p className="text-[12px] text-stone-500">Cardápio digital</p>
          </div>
          <span className="ml-auto rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: `${branding.primaryColor}18`, color: branding.primaryColor }}>
            Menu
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="mb-8 rounded-lg border border-black/5 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-4" style={{ color: branding.primaryColor }} />
            <h2 className="text-[13px] font-semibold">Simule sua entrega</h2>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">Confira a taxa estimada antes de concluir seu pedido.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-medium text-stone-600">Endereço
              <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Rua e número" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
            </label>
            <label className="block text-[11px] font-medium text-stone-600">Bairro
              {branding.deliveryFees.model === "bairro" ? (
                <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]">
                  {branding.deliveryFees.neighborhoodFees.map((rule) => <option key={rule.neighborhood} value={rule.neighborhood}>{rule.neighborhood}</option>)}
                  {!branding.deliveryFees.neighborhoodFees.length && <option value="Centro">Centro</option>}
                </select>
              ) : (
                <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Ex.: Centro" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
              )}
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
            <label className="block text-[11px] font-medium text-stone-600">CEP
              <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" placeholder="00000-000" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
            </label>
            <button type="button" onClick={() => void locatePostalCode()} disabled={geocoding || !postalCode.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"><MapPin className="size-3.5" />{geocoding ? "Buscando..." : "Calcular distância"}</button>
            <label className="block text-[11px] font-medium text-stone-600">Distância (km)
              <input type="number" min="0" step="0.1" value={distanceKm} onChange={(event) => setDistanceKm(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2.5" style={{ backgroundColor: `${branding.primaryColor}12` }}>
            <span className="text-[11px] text-stone-600">Taxa de entrega estimada · {distanceKm.toFixed(1)} km</span>
            <span className="text-[15px] font-bold" style={{ color: branding.primaryColor }}>{brl(deliveryFee)}</span>
          </div>
        </section>
        {categories.length ? categories.map((category) => (
          <section key={category} className="mb-8">
            <h2 className="border-b border-black/10 pb-2 font-display text-lg font-semibold">{category}</h2>
            <div className="divide-y divide-black/5">
              {availableItems.filter((item) => item.category === category).map((item) => (
                <article key={item.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold">{item.name}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-stone-500">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold" style={{ color: branding.primaryColor }}>{brl(item.price)}</span>
                </article>
              ))}
            </div>
          </section>
        )) : (
          <div className="rounded-lg border border-black/5 bg-white p-8 text-center">
            <h2 className="font-display text-lg font-semibold">Cardápio em atualização</h2>
            <p className="mt-2 text-[13px] text-stone-500">Este restaurante ainda não publicou itens disponíveis.</p>
          </div>
        )}
      </div>
      <footer className="border-t border-black/5 bg-white px-4 py-5 text-center text-[11px] text-stone-500">
        Cardápio atualizado por {restaurantName}
      </footer>
    </main>
  );
}
