import { createFileRoute } from "@tanstack/react-router";
import { BellRing, ClipboardList, Minus, Plus, ShoppingBag, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { brl, type MenuItem } from "@/lib/mock";
import { apiAssetUrl, type ApiPromotion } from "@/lib/api";
import { dispatchAbandonedCartCouponReminder } from "@/lib/delivery-notifications";
import { useTenantCoupons, updateTenantCoupons, validateCoupon } from "@/lib/coupon-store";
import { useTenantMenu } from "@/lib/menu-store";
import { updateTenantOperations, useTenantOperations } from "@/lib/operations";
import { hasPublicApi, publicApiUrl } from "@/lib/public-api";
import { useTenantBranding } from "@/lib/tenant-branding";

type CartLine = { id: string; item: MenuItem; quantity: number; notes: string; addons: MenuItem[] };
type TableSnapshot = {
  session: { id: number; tableLabel: string; closeRequestedAt: string | null } | null;
  orders: {
    id: number;
    itemsJson: { name: string; quantity: number; price: number; notes?: string }[] | null;
    total: string;
    status: string;
    createdAt: string;
    paymentMethod: string | null;
  }[];
  total: number;
};
type PublicRestaurantPresentation = {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  faviconUrl: string | null;
  openingHours: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  publicPolicy: string | null;
};

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
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productNotes, setProductNotes] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "cart">("menu");
  const [tableSnapshot, setTableSnapshot] = useState<TableSnapshot | null>(null);
  const [tableSnapshotLoaded, setTableSnapshotLoaded] = useState(false);
  const [serverMenuItems, setServerMenuItems] = useState<MenuItem[] | null>(() => hasPublicApi() ? [] : null);
  const [restaurantPresentation, setRestaurantPresentation] = useState<PublicRestaurantPresentation | null>(null);
  const [serverPromotions, setServerPromotions] = useState<ApiPromotion[]>([]);
  const [closeRequestSent, setCloseRequestSent] = useState(false);
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
    if (!hasPublicApi()) return;
    let active = true;
    void fetch(publicApiUrl(`/api/public/restaurants/${encodeURIComponent(slug)}`))
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(payload.error ?? "Não foi possível carregar o cardápio publicado.");
        }
        return response.json() as Promise<{
          restaurant: PublicRestaurantPresentation;
          products: { id: number; name: string; description: string | null; price: string; category: string | null; imageUrl: string | null; status: string }[];
          promotions: ApiPromotion[];
        }>;
      })
      .then((payload) => {
        if (active) {
          setRestaurantPresentation(payload.restaurant);
          setRestaurantName(payload.restaurant.name);
          setServerPromotions(payload.promotions.map((promotion) => ({ ...promotion, imageUrl: apiAssetUrl(promotion.imageUrl) })));
          setServerMenuItems(payload.products.map((product) => ({
            id: String(product.id),
            name: product.name,
            description: product.description ?? "",
            price: Number(product.price),
            category: product.category ?? "Outros",
            imageUrl: product.imageUrl ? apiAssetUrl(product.imageUrl) : undefined,
            available: product.status === "DISPONIVEL",
          })));
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Erro ao carregar o cardápio.");
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!hydrated || !Number.isInteger(tableNumber) || tableNumber < 1) return;
    let active = true;
    const openSession = async () => {
      if (hasPublicApi()) {
        try {
            const response = await fetch(publicApiUrl(`/api/public/restaurants/${encodeURIComponent(slug)}/tables/${encodeURIComponent(`Mesa ${tableNumber}`)}/open`), { method: "POST" });
            if (!response.ok) {
              const payload = await response.json().catch(() => ({})) as { error?: string };
              setNotice(payload.error ?? "Não foi possível abrir a comanda desta mesa.");
            }
        } catch {
            setNotice("Não foi possível conectar ao servidor para abrir a comanda.");
        }
      }
      if (!active) return;
      if (!hasPublicApi()) {
        const openedAt = new Date().toISOString();
        updateTenantOperations(slug, (current) => ({
          ...current,
          tables: current.tables.map((table) => table.id === tableNumber
            ? { ...table, status: table.status === "Livre" ? "Ocupada" : table.status, openedAt: table.openedAt ?? openedAt, openedBy: table.openedBy ?? "Cliente via QR" }
            : table),
        }));
      }
    };
    void openSession();
    return () => { active = false; };
  }, [hydrated, slug, tableNumber]);

  useEffect(() => {
    if (!hydrated || !hasPublicApi() || !Number.isInteger(tableNumber)) return;
    const tablePath = `/api/public/restaurants/${encodeURIComponent(slug)}/tables/${encodeURIComponent(`Mesa ${tableNumber}`)}`;
    let active = true;
    const loadSnapshot = async () => {
      const response = await fetch(publicApiUrl(tablePath));
      if (!response.ok) throw new Error("Não foi possível carregar a comanda compartilhada.");
      const snapshot = await response.json() as TableSnapshot;
      if (active) {
        setTableSnapshot(snapshot);
        setCloseRequestSent(Boolean(snapshot.session?.closeRequestedAt));
        setTableSnapshotLoaded(true);
      }
    };
    void loadSnapshot().catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : "Erro ao carregar os pedidos da mesa.");
    });
    const stream = new EventSource(publicApiUrl(`${tablePath}/stream`));
    stream.addEventListener("table", (event) => {
      if (!active) return;
      const snapshot = JSON.parse((event as MessageEvent<string>).data) as TableSnapshot;
      setTableSnapshot(snapshot);
      setCloseRequestSent(Boolean(snapshot.session?.closeRequestedAt));
      setTableSnapshotLoaded(true);
    });
    stream.onerror = () => {
      if (active) setNotice("A conexão ao vivo foi interrompida. Tentando reconectar…");
    };
    return () => {
      active = false;
      stream.close();
    };
  }, [hydrated, slug, tableNumber]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${slug} · Mesa ${numero}`;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousFavicon = favicon?.href;
    if (favicon && (restaurantPresentation?.faviconUrl || branding.faviconUrl)) {
      favicon.href = apiAssetUrl(restaurantPresentation?.faviconUrl ?? branding.faviconUrl);
    }
    return () => {
      document.title = previousTitle;
      if (favicon && previousFavicon) favicon.href = previousFavicon;
    };
  }, [branding.faviconUrl, numero, restaurantPresentation?.faviconUrl, slug]);

  const menuItems = serverMenuItems ?? items;
  const availableItems = menuItems.filter((item) => item.available);
  const categories = [...new Set(availableItems.map((item) => item.category))];
  const total = useMemo(() => cart.reduce((sum, line) => sum + (line.item.price + line.addons.reduce((subtotal, addon) => subtotal + addon.price, 0)) * line.quantity, 0), [cart]);
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
  const tableStatus = tableSnapshot?.session
    ? "Comanda aberta"
    : operations.tables.find((table) => table.id === tableNumber)?.status ?? "Ocupada";

  function openProductDetails(item: MenuItem) {
    setSelectedProduct(item);
    setProductQuantity(1);
    setProductNotes("");
    setSelectedAddons([]);
  }

  function addItem() {
    if (!selectedProduct) return;
    const addons = availableItems.filter((item) => selectedAddons.includes(item.id));
    setCart((current) => [...current, {
      id: crypto.randomUUID(),
      item: selectedProduct,
      quantity: productQuantity,
      notes: productNotes.trim(),
      addons,
    }]);
    setSelectedProduct(null);
    setReminderSent(false);
    setNotice("");
  }

  function changeQuantity(itemId: string, delta: number) {
    setCart((current) => {
      const index = current.findIndex((line) => line.item.id === itemId);
      if (index < 0 && delta > 0) {
        const item = availableItems.find((entry) => entry.id === itemId);
        return item ? [...current, { id: crypto.randomUUID(), item, quantity: 1, notes: "", addons: [] }] : current;
      }
      if (index < 0) return current;
      const target = current[index];
      const quantity = target.quantity + delta;
      if (quantity <= 0) return current.filter((line) => line.id !== target.id);
      return current.map((line) => line.id === target.id ? { ...line, quantity } : line);
    });
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

  async function sendOrder() {
    if (!cart.length) return;
    if (hasPublicApi() && tableSnapshotLoaded && !tableSnapshot?.session) {
      setNotice("A comanda foi encerrada pelo caixa. Reabra o cardápio da mesa para iniciar outro pedido.");
      return;
    }
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
    if (hasPublicApi()) {
      try {
        const response = await fetch(publicApiUrl(`/api/public/restaurants/${encodeURIComponent(slug)}/orders`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableLabel: `Mesa ${tableNumber}`,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            paymentMethod,
            items: cart.flatMap((line) => [
              {
                productId: Number(line.item.id),
                price: line.item.price,
                quantity: line.quantity,
                notes: line.notes || undefined,
              },
              ...line.addons.map((addon) => ({
                productId: Number(addon.id),
                price: addon.price,
                quantity: line.quantity,
                notes: `Adicional de ${line.item.name}`,
              })),
            ]),
          }),
        });
        const result = await response.json() as { id?: number; error?: string; changedPrices?: { name: string; price: number }[] };
        if (!response.ok) {
          if (result.changedPrices?.length) {
            setNotice(`O preço de ${result.changedPrices.map((product) => product.name).join(", ")} mudou. Atualize o carrinho e confirme novamente.`);
          } else {
            setNotice(result.error ?? "Não foi possível enviar o pedido. Revise e tente novamente.");
          }
          return;
        }
        setNotice(`Pedido #${result.id} enviado à cozinha. A comanda da mesa continua aberta.`);
      } catch {
        setNotice("Não foi possível enviar o pedido ao servidor. Seus itens continuam no carrinho.");
        return;
      }
    } else {
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
          items: cart.flatMap((line) => [
            { name: line.item.name, qty: line.quantity, price: line.item.price },
            ...line.addons.map((addon) => ({ name: `${addon.name} (${line.item.name})`, qty: line.quantity, price: addon.price })),
          ]),
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
      setNotice(`Pedido enviado à cozinha. Número ${orderId}.`);
    }
    setCart([]);
    setCartOpen(false);
    setActiveTab("orders");
    setAppliedCouponCode("");
  }

  async function requestTableClose() {
    if (!hasPublicApi()) {
      setNotice("Solicitação de fechamento disponível quando o restaurante estiver conectado ao servidor.");
      return;
    }
    try {
      const response = await fetch(publicApiUrl(`/api/public/restaurants/${encodeURIComponent(slug)}/tables/${encodeURIComponent(`Mesa ${tableNumber}`)}/close-request`), { method: "POST" });
      const payload = await response.json() as TableSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível chamar o caixa.");
      setTableSnapshot(payload);
      setTableSnapshotLoaded(true);
      setCloseRequestSent(true);
      setNotice("O caixa foi avisado. Aguarde a confirmação antes de sair.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível solicitar o fechamento da conta.");
    }
  }

  if (!hydrated || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 100) {
    return <main className="grid min-h-screen place-items-center bg-stone-50 p-6 text-[13px] text-stone-500">Carregando cardápio...</main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-28 text-ink">
      <header className="border-b border-black/5 bg-white">
        {restaurantPresentation?.coverUrl ? (
          <div className="relative h-32 overflow-hidden bg-stone-200 sm:h-44">
            <img src={apiAssetUrl(restaurantPresentation.coverUrl)} alt={`${restaurantName} - capa`} className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
        ) : null}
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {restaurantPresentation?.logoUrl || branding.logoUrl ? <img src={apiAssetUrl(restaurantPresentation?.logoUrl ?? branding.logoUrl)} alt={restaurantName} className="size-12 rounded-md object-contain" /> : <span className="grid size-12 place-items-center rounded-md bg-stone-100 font-display text-lg font-bold" style={{ color: branding.primaryColor }}>{restaurantName.charAt(0)}</span>}
          <div className="min-w-0 flex-1"><h1 className="truncate font-display text-lg font-semibold">{restaurantName}</h1><p className="text-[11px] text-stone-500">Cardápio digital · Mesa {tableNumber}</p>{restaurantPresentation?.openingHours ? <p className="mt-1 text-[10px] text-stone-500">{restaurantPresentation.openingHours}</p> : null}</div>
          <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${tableStatus === "Livre" ? "bg-stone-100 text-stone-500" : "bg-emerald-50 text-emerald-700"}`}>{tableStatus}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {serverPromotions.length > 0 ? (
          <section aria-label="Promoções" className="mb-5 grid gap-3 sm:grid-cols-2">
            {serverPromotions.slice(0, 2).map((promotion) => (
              <article key={promotion.id} className="relative isolate overflow-hidden rounded-lg bg-stone-900 text-white">
                <img src={promotion.imageUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-60" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 to-transparent" />
                <div className="min-h-28 p-4"><h2 className="font-display text-base font-semibold">{promotion.title}</h2>{promotion.description ? <p className="mt-1 text-[10px] text-white/85">{promotion.description}</p> : null}</div>
              </article>
            ))}
          </section>
        ) : null}
        {notice && <div role="status" className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-medium text-emerald-800">{notice}</div>}
        {hasPublicApi() && tableSnapshotLoaded && !tableSnapshot?.session && <div role="alert" className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">A comanda desta mesa não está aberta. Atualize o QR ou solicite ajuda ao restaurante.</div>}
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

        <nav aria-label="Navegação da mesa" className="mb-6 flex gap-2 rounded-lg bg-white p-1 shadow-sm">
          <button type="button" onClick={() => { setActiveTab("menu"); setCartOpen(false); }} className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold ${activeTab === "menu" ? "text-white" : "text-stone-600"}`} style={activeTab === "menu" ? { backgroundColor: branding.primaryColor } : undefined}>Cardápio</button>
          <button type="button" onClick={() => { setActiveTab("orders"); setCartOpen(false); }} className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold ${activeTab === "orders" ? "text-white" : "text-stone-600"}`} style={activeTab === "orders" ? { backgroundColor: branding.primaryColor } : undefined}>Meus pedidos ({tableSnapshot?.orders.length ?? 0})</button>
          <button type="button" onClick={() => { setActiveTab("cart"); setCartOpen(true); }} className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold ${activeTab === "cart" ? "text-white" : "text-stone-600"}`} style={activeTab === "cart" ? { backgroundColor: branding.primaryColor } : undefined}>Carrinho ({cart.reduce((sum, line) => sum + line.quantity, 0)})</button>
        </nav>

        {activeTab === "orders" ? (
          <section className="space-y-4">
            <div className="rounded-lg border border-black/5 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-display text-base font-semibold">Comanda da Mesa {tableNumber}</h2><p className="mt-1 text-[11px] text-stone-500">Pedidos de todos os aparelhos conectados a esta mesa.</p></div>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: branding.primaryColor }}>{brl(tableSnapshot?.total ?? 0)}</span>
              </div>
              <div className="mt-3 space-y-3">
                {tableSnapshot?.orders.length ? tableSnapshot.orders.map((order) => (
                  <article key={order.id} className="rounded-md bg-stone-50 p-3">
                    <div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold">Pedido #{order.id}</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-600">{order.status === "PENDENTE" ? "Recebido" : order.status === "PREPARANDO" ? "Em preparo" : order.status === "ENTREGUE" ? "Pronto" : order.status === "SAIU_PARA_ENTREGA" ? "A caminho" : order.status === "FINALIZADO" ? "Finalizado" : order.status === "CANCELADO" ? "Cancelado" : order.status}</span></div>
                    <p className="mt-2 text-[11px] leading-relaxed text-stone-600">{order.itemsJson?.map((item) => `${item.quantity}x ${item.name}${item.notes ? ` (${item.notes})` : ""}`).join(" · ") ?? "Itens do pedido"}</p>
                    <div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{order.paymentMethod ? ` · ${order.paymentMethod}` : ""}</span><span className="font-semibold text-ink">{brl(order.total)}</span></div>
                  </article>
                )) : <p className="rounded-md bg-stone-50 p-3 text-[11px] text-stone-500">Ainda não há pedidos registrados nesta comanda.</p>}
              </div>
              <button type="button" onClick={() => void requestTableClose()} disabled={closeRequestSent || !tableSnapshot?.orders.length} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300" style={{ backgroundColor: closeRequestSent ? undefined : branding.primaryColor }}>
                <BellRing className="size-4" />{closeRequestSent ? "Caixa avisado · aguardando atendimento" : "Solicitar fechamento da conta"}
              </button>
            </div>
          </section>
        ) : activeTab === "menu" && categories.length ? categories.map((category) => (
          <section key={category} className="mb-8">
            <h2 className="mb-3 border-b border-black/10 pb-2 font-display text-base font-semibold">{category}</h2>
            <div className="space-y-3">
              {availableItems.filter((item) => item.category === category).map((item) => {
                const quantity = cart.filter((line) => line.item.id === item.id).reduce((sum, line) => sum + line.quantity, 0);
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
                          ) : <button type="button" onClick={() => openProductDetails(item)} className="rounded-md px-3 py-2 text-[11px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Personalizar</button>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )) : activeTab === "menu" ? <div className="rounded-lg border border-black/5 bg-white p-8 text-center text-[13px] text-stone-500">O cardápio está sendo atualizado.</div> : null}
      </div>
      <footer className="mx-auto mb-24 max-w-3xl px-4 pb-5 pt-2 text-[10px] leading-relaxed text-stone-500">
        <p className="font-semibold text-stone-700">{restaurantName}</p>
        {restaurantPresentation?.address ? <p className="mt-1">{restaurantPresentation.address}{restaurantPresentation.city ? ` · ${restaurantPresentation.city}` : ""}{restaurantPresentation.state ? `/${restaurantPresentation.state}` : ""}</p> : null}
        {restaurantPresentation?.openingHours ? <p className="mt-1">Funcionamento: {restaurantPresentation.openingHours}</p> : null}
        {restaurantPresentation?.publicPolicy ? <p className="mt-1 whitespace-pre-line">{restaurantPresentation.publicPolicy}</p> : null}
      </footer>
      {selectedProduct && <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-4" onClick={() => setSelectedProduct(null)}>
        <section role="dialog" aria-modal="true" aria-label={`Personalizar ${selectedProduct.name}`} className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 sm:max-w-lg sm:rounded-xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">{selectedProduct.name}</h2><p className="mt-1 text-[11px] text-stone-500">{selectedProduct.category}</p></div><button type="button" onClick={() => setSelectedProduct(null)} className="text-[12px] text-stone-500">Fechar</button></div>
          {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="mt-4 h-48 w-full rounded-lg object-cover" /> : <div className="mt-4 grid h-32 place-items-center rounded-lg bg-stone-100 text-stone-400"><Utensils className="size-8" /></div>}
          <p className="mt-3 text-[12px] leading-relaxed text-stone-600">{selectedProduct.description || "Prepare-se para aproveitar este item."}</p>
          <label className="mt-4 block text-[11px] font-semibold text-stone-600">Observações do item
            <textarea value={productNotes} onChange={(event) => setProductNotes(event.target.value.slice(0, 280))} maxLength={280} placeholder="Ex.: sem cebola, bem passado..." className="mt-1.5 min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-normal" />
          </label>
          {availableItems.filter((item) => /adicional|extra|complemento|molho/i.test(item.category)).length > 0 && <fieldset className="mt-4 space-y-2">
            <legend className="text-[11px] font-semibold text-stone-600">Adicionais e complementos</legend>
            {availableItems.filter((item) => /adicional|extra|complemento|molho/i.test(item.category)).map((addon) => (
              <label key={addon.id} className="flex items-center gap-2 rounded-md border border-black/5 px-3 py-2 text-[11px]">
                <input type="checkbox" checked={selectedAddons.includes(addon.id)} onChange={(event) => setSelectedAddons((current) => event.target.checked ? [...current, addon.id] : current.filter((id) => id !== addon.id))} />
                <span className="flex-1">{addon.name}</span><span className="font-semibold">{brl(addon.price)}</span>
              </label>
            ))}
          </fieldset>}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><button type="button" aria-label="Diminuir quantidade" onClick={() => setProductQuantity((current) => Math.max(1, current - 1))} className="grid size-9 place-items-center rounded-md border border-black/10"><Minus className="size-4" /></button><span className="min-w-5 text-center text-[13px] font-semibold">{productQuantity}</span><button type="button" aria-label="Aumentar quantidade" onClick={() => setProductQuantity((current) => Math.min(99, current + 1))} className="grid size-9 place-items-center rounded-md border border-black/10"><Plus className="size-4" /></button></div>
            <button type="button" onClick={addItem} className="rounded-md px-4 py-2.5 text-[12px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Adicionar · {brl((selectedProduct.price + availableItems.filter((item) => selectedAddons.includes(item.id)).reduce((sum, item) => sum + item.price, 0)) * productQuantity)}</button>
          </div>
        </section>
      </div>}
      {confirmOrderOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
        <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-table-order-title" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
          <h2 id="confirm-table-order-title" className="font-display text-lg font-semibold">Confirmar pedido da Mesa {tableNumber}</h2>
          <p className="mt-1 text-[12px] text-stone-500">Confira os itens antes de enviar para a cozinha.</p>
          <div className="mt-4 divide-y divide-black/5">{cart.map((line) => <p key={line.id} className="py-2 text-[11px]">{line.quantity}x {line.item.name}{line.addons.length ? ` + ${line.addons.map((addon) => addon.name).join(", ")}` : ""}{line.notes ? ` · ${line.notes}` : ""}</p>)}</div>
          {!cart.some((line) => /bebid|suco|refriger|água|agua|drink/i.test(line.item.category)) && availableItems.some((item) => /bebid|suco|refriger|água|agua|drink/i.test(item.category)) && <div className="mt-3 rounded-md bg-emerald-50 p-3">
            <p className="text-[11px] font-semibold text-emerald-900">Que tal uma bebida para acompanhar?</p>
            <div className="mt-2 flex flex-wrap gap-2">{availableItems.filter((item) => /bebid|suco|refriger|água|agua|drink/i.test(item.category)).slice(0, 3).map((drink) => <button key={drink.id} type="button" onClick={() => { setCart((current) => [...current, { id: crypto.randomUUID(), item: drink, quantity: 1, notes: "", addons: [] }]); setConfirmOrderOpen(false); }} className="rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-emerald-900">{drink.name} · {brl(drink.price)} +</button>)}</div>
          </div>}
          <p className="mt-4 flex justify-between border-t border-black/5 pt-3 text-[13px] font-bold"><span>Total</span><span style={{ color: branding.primaryColor }}>{brl(finalTotal)}</span></p>
          <div className="mt-4 flex gap-2"><button type="button" onClick={() => setConfirmOrderOpen(false)} className="flex-1 rounded-md border border-black/10 px-3 py-2.5 text-[11px] font-semibold text-stone-700">Revisar carrinho</button><button type="button" onClick={() => { setConfirmOrderOpen(false); void sendOrder(); }} className="flex-1 rounded-md px-3 py-2.5 text-[11px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Sim, enviar pedido</button></div>
        </section>
      </div>}
      {cart.length > 0 && cartOpen && <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={() => setCartOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Seu pedido" className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 sm:max-w-md sm:rounded-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Seu pedido</h2><p className="text-[11px] text-stone-500">Mesa {tableNumber}</p></div><button type="button" onClick={() => setCartOpen(false)} className="text-[12px] text-stone-500">Fechar</button></div>
            <div className="mt-4 divide-y divide-black/5">{cart.map((line) => <div key={line.id} className="py-3 text-[12px]">
              <div className="flex items-center justify-between gap-3"><span>{line.quantity}x {line.item.name}</span><span className="font-semibold">{brl(line.quantity * (line.item.price + line.addons.reduce((sum, addon) => sum + addon.price, 0)))}</span></div>
              {line.addons.length > 0 && <p className="mt-1 text-[10px] text-stone-500">Adicionais: {line.addons.map((addon) => addon.name).join(", ")}</p>}
              {line.notes && <p className="mt-1 text-[10px] text-stone-500">Obs.: {line.notes}</p>}
            </div>)}</div>
            {hasPublicApi() && <label className="mt-4 block text-[11px] font-semibold text-stone-600">Forma de pagamento
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-[12px]">
                <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão de crédito/débito</option><option value="outros">Pagar no caixa</option>
              </select>
              <span className="mt-1 block text-[10px] font-normal text-stone-500">O pagamento será confirmado pelo caixa ao encerrar a comanda.</span>
            </label>}
            {!hasPublicApi() && <div className="mt-4 rounded-md bg-stone-50 p-3">
              <label className="block text-[11px] font-semibold text-stone-600">Aplicar cupom de desconto
                <div className="mt-1.5 flex gap-2">
                  <input value={couponDraft} onChange={(event) => { setCouponDraft(event.target.value.toUpperCase()); setAppliedCouponCode(""); }} placeholder="Ex.: BEMVINDO10" className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-mono" />
                  <button type="button" disabled={!couponPreview.valid} onClick={applyCoupon} className="rounded-md px-3 py-2 text-[11px] font-semibold text-white disabled:bg-stone-300" style={{ backgroundColor: couponPreview.valid ? branding.primaryColor : undefined }}>Aplicar</button>
                </div>
              </label>
              {couponDraft.trim() && <p className={`mt-2 text-[10px] ${couponPreview.valid ? "text-emerald-700" : "text-rose-600"}`}>{couponPreview.valid ? `Cupom válido · ${brl(couponPreview.discountAmount)} de desconto${couponPreview.coupon?.kind === "frete-gratis" ? " no frete" : ""}.` : couponPreview.error}</p>}
              {appliedCoupon.valid && <p className="mt-1 text-[10px] font-medium text-emerald-700">Cupom {appliedCoupon.coupon?.code} aplicado.</p>}
            </div>}
            <div className="mt-3 space-y-2 border-t border-black/5 pt-3 text-[12px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(total)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Desconto {appliedCoupon.coupon?.code}</span><span>- {brl(couponDiscount)}</span></div>}
              <div className="flex justify-between border-t border-black/5 pt-2 text-[14px] font-semibold"><span>Total</span><span style={{ color: branding.primaryColor }}>{brl(finalTotal)}</span></div>
            </div>
            <button type="button" onClick={() => setConfirmOrderOpen(true)} className="mt-4 w-full rounded-md py-3 text-[12px] font-semibold text-white" style={{ backgroundColor: branding.primaryColor }}>Confirmar e enviar pedido à cozinha</button>
          </section>
        </div>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button type="button" onClick={() => { setActiveTab("menu"); setCartOpen(false); }} aria-current={activeTab === "menu" ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-1 text-[9px] font-semibold ${activeTab === "menu" ? "text-emerald-700" : "text-stone-600"}`}><Utensils className="size-4" />Cardápio</button>
          <button type="button" onClick={() => { setActiveTab("orders"); setCartOpen(false); }} aria-current={activeTab === "orders" ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-1 text-[9px] font-semibold ${activeTab === "orders" ? "text-emerald-700" : "text-stone-600"}`}><ClipboardList className="size-4" />Meus pedidos</button>
          <button type="button" onClick={() => { setActiveTab("cart"); setCartOpen(true); }} aria-current={activeTab === "cart" ? "page" : undefined} className="flex min-h-12 flex-[2] items-center justify-between rounded-md px-3 text-white" style={{ backgroundColor: branding.primaryColor }}><span className="flex items-center gap-2 text-[11px] font-semibold"><ShoppingBag className="size-4" />Carrinho · {cart.reduce((sum, line) => sum + line.quantity, 0)}</span><span className="text-[12px] font-bold">{brl(total)}</span></button>
        </div>
      </div>
    </main>
  );
}
