import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import logo from "@/assets/logo.png";
import { Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, MapPin, Minus, Plus, Search, ShoppingBag, X, XCircle } from "lucide-react";
import { Btn, inputCls, useLoad } from "@/components/kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CartSummary, cartItems, cartTotal, changeQty, ProductPicker, type Cart } from "@/components/order-builder";
import { apiAssetUrl, brl, type ApiPublicOrderTracking } from "@/lib/api";
import { data } from "@/lib/data";

export const Route = createFileRoute("/r/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    mesa: typeof s.mesa === "string" ? s.mesa : undefined,
    menu: typeof s.menu === "string" ? s.menu : undefined,
    pedido: typeof s.pedido === "string" ? s.pedido : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cardápio digital — RestauranteAI" },
      { name: "description", content: "Veja o cardápio e faça seu pedido direto da mesa." },
      { property: "og:title", content: "Cardápio digital — RestauranteAI" },
      { property: "og:description", content: "Veja o cardápio e faça seu pedido direto da mesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicMenu,
});

function PublicMenu() {
  const { slug } = Route.useParams();
  const { mesa, menu, pedido } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const res = useLoad(() => data.publicMenu(slug, menu), [slug, menu]);
  const tracking = useLoad(
    () => (pedido ? data.publicOrderStatus(pedido) : Promise.resolve(null)),
    [pedido],
    pedido ? 3000 : undefined,
  );
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [activePromotion, setActivePromotion] = useState(0);
  const faviconUrl = res.data?.restaurant.faviconUrl;
  const promotionCount = res.data?.promotions?.length ?? 0;

  useEffect(() => {
    if (!faviconUrl) return;
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const created = !favicon;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.append(favicon);
    }
    const originalHref = favicon.href;
    favicon.href = apiAssetUrl(faviconUrl);
    return () => {
      if (created) favicon?.remove();
      else if (favicon) favicon.href = originalHref;
    };
  }, [faviconUrl]);

  useEffect(() => {
    if (promotionCount < 2) return;
    const timer = window.setInterval(() => {
      setActivePromotion((current) => (current + 1) % promotionCount);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [promotionCount]);

  async function send() {
    setSubmitting(true);
    setErr("");
    try {
      const result = await data.publicOrder(slug, {
        tableLabel: mesa,
        customerName: name || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes || undefined,
        items: cartItems(cart),
      });
      setCart({});
      setShowCart(false);
      setConfirmOpen(false);
      setDone(true);
      await navigate({
        to: "/r/$slug",
        params: { slug },
        search: (previous) => ({ ...previous, pedido: result.trackingToken }),
        replace: true,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao enviar pedido";
      setErr(message);
      if (message.toLocaleLowerCase("pt-BR").includes("preço")) {
        try {
          const latestMenu = await data.publicMenu(slug, menu);
          const latestProducts = new Map(latestMenu.products.map((product) => [product.id, product]));
          setCart((previous) => {
            const refreshed: Cart = {};
            for (const item of cartItems(previous)) {
              const latest = latestProducts.get(item.productId);
              if (latest) refreshed[item.productId] = { ...item, name: latest.name, price: Number(latest.price) };
            }
            return refreshed;
          });
          setErr(`${message} Os itens disponíveis foram atualizados; revise o novo total e confirme novamente.`);
        } catch (refreshError) {
          setErr(`${message} Não foi possível atualizar os preços agora. ${refreshError instanceof Error ? refreshError.message : ""}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (res.error) return <div className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center text-[14px] text-stone-600">{res.error}</div>;
  if (!res.data) return <div className="min-h-screen bg-stone-100" />;
  const r = res.data.restaurant;
  const promotions = res.data.promotions ?? [];
  const currentPromotion = promotions.length ? promotions[activePromotion % promotions.length] : null;
  const count = cartItems(cart).reduce((a, i) => a + i.quantity, 0);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = res.data.products.filter((product) =>
    !normalizedSearch ||
    `${product.name} ${product.description ?? ""} ${product.category ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch),
  );
  const containsDrink = cartItems(cart).some((item) =>
    /bebid|suco|refriger|água|agua|drink/i.test(
      res.data.products.find((product) => product.id === item.productId)?.category ?? "",
    ),
  );
  const recommendations = containsDrink
    ? []
    : res.data.products
        .filter((product) => /bebid|suco|refriger|água|agua|drink/i.test(product.category ?? ""))
        .filter((product) => !cart[product.id]?.quantity)
        .slice(0, 3);
  const setItemQuantity = (productId: number, delta: number) => {
    setErr("");
    setCart((previous) => {
      const current = previous[productId];
      if (!current) return previous;
      const quantity = Math.max(0, current.quantity + delta);
      const next = { ...previous };
      if (quantity === 0) delete next[productId];
      else next[productId] = { ...current, quantity };
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-28 font-sans text-ink">
      <header className="relative overflow-hidden bg-ink text-stone-300">
        {r.coverUrl ? <img src={apiAssetUrl(r.coverUrl)} alt="" className="absolute inset-0 size-full object-cover opacity-30" /> : null}
        {r.coverUrl ? <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/35" /> : null}
        <div className="pointer-events-none absolute -right-20 -top-32 size-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl items-center gap-5 px-5 py-8 sm:px-8 sm:py-12">
          <img
            src={apiAssetUrl(r.logoUrl) || logo}
            alt={`${r.name} logo`}
            onError={(event) => { event.currentTarget.src = logo; }}
            className="size-16 shrink-0 rounded-2xl border border-white/10 bg-white/10 object-cover shadow-lg sm:size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Cardápio digital</p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{r.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-300">
              {r.description ?? res.data.menu?.name ?? "Peça seus favoritos direto por aqui."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {mesa ? (
                <span className="rounded-full bg-brand px-3 py-1.5 font-semibold text-white">{mesa}</span>
              ) : null}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${r.isOpen ? "bg-white/10 text-white" : "bg-red-500/20 text-red-200"}`}>
                <span className={`size-1.5 rounded-full ${r.isOpen ? "bg-emerald-400" : "bg-red-400"}`} />
                {r.isOpen ? "Aberto agora" : "Fechado"}
              </span>
              {r.openingHours ? (
                <span className="inline-flex items-center gap-1.5 text-stone-400">
                  <Clock3 className="size-3.5" /> {r.openingHours}
                </span>
              ) : null}
              {r.address ? (
                <span className="inline-flex items-center gap-1.5 text-stone-400">
                  <MapPin className="size-3.5" /> {r.city ?? r.address}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      {currentPromotion ? (
        <section aria-label="Promoções do restaurante" className="mx-auto mt-5 max-w-6xl px-4 sm:px-8">
          <div className="relative isolate overflow-hidden rounded-2xl bg-stone-900 shadow-lg">
            <img src={apiAssetUrl(currentPromotion.imageUrl)} alt={currentPromotion.title ?? "Promoção do restaurante"} className="absolute inset-0 -z-20 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
            <div className="flex min-h-40 items-center justify-between gap-3 px-5 py-6 text-white sm:min-h-52 sm:px-10">
              <div className="max-w-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Destaques da casa</p>
                <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{currentPromotion.title}</h2>
                {currentPromotion.description ? <p className="mt-2 text-sm text-white/85">{currentPromotion.description}</p> : null}
              </div>
              {promotions.length > 1 ? (
                <div className="flex shrink-0 gap-2">
                  <button type="button" aria-label="Promoção anterior" onClick={() => setActivePromotion((current) => (current - 1 + promotions.length) % promotions.length)} className="grid size-9 place-items-center rounded-full bg-white/20 backdrop-blur hover:bg-white/30"><ChevronLeft className="size-5" /></button>
                  <button type="button" aria-label="Próxima promoção" onClick={() => setActivePromotion((current) => (current + 1) % promotions.length)} className="grid size-9 place-items-center rounded-full bg-white/20 backdrop-blur hover:bg-white/30"><ChevronRight className="size-5" /></button>
                </div>
              ) : null}
            </div>
            {promotions.length > 1 ? <div className="absolute bottom-3 left-5 flex gap-1.5 sm:left-10">{promotions.map((promotion, index) => <button key={promotion.id} type="button" aria-label={`Mostrar promoção ${index + 1}`} onClick={() => setActivePromotion(index)} className={`h-1.5 rounded-full transition-all ${index === activePromotion % promotions.length ? "w-7 bg-white" : "w-2 bg-white/50"}`} />)}</div> : null}
          </div>
        </section>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
        {done ? (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            Pedido enviado! A cozinha já recebeu. Acompanhe o preparo abaixo ou continue escolhendo.
          </div>
        ) : null}
        {pedido ? (
          <OrderTracking
            data={tracking.data}
            error={tracking.error}
            onRefresh={() => tracking.reload()}
          />
        ) : null}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Feito para você</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Escolha seus favoritos</h2>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar no cardápio"
                aria-label="Buscar produtos no cardápio"
                className="w-full rounded-full border border-stone-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              />
            </label>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-500 ring-1 ring-black/5">
              {visibleProducts.length} {visibleProducts.length === 1 ? "item" : "itens"}
            </span>
          </div>
        </div>
        {visibleProducts.length ? (
          <ProductPicker products={visibleProducts} cart={cart} brandColor={r.primaryColor} onChange={(c) => { setCart(c); setDone(false); setErr(""); }} />
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-500">
            {res.data.products.length ? "Nenhum produto encontrado para essa busca." : "Este cardápio ainda não tem produtos disponíveis."}
          </div>
        )}
      </main>
      <footer className="bg-ink px-5 py-8 text-stone-300 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2">
          <div>
            <p className="font-display text-lg font-semibold text-white">{r.name}</p>
            {r.address ? <p className="mt-2 text-sm">{r.address}{r.city ? ` · ${r.city}` : ""}{r.state ? `/${r.state}` : ""}</p> : null}
            {r.openingHours ? <p className="mt-1 text-sm">Funcionamento: {r.openingHours}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-white">Informações e políticas</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-stone-400">{r.publicPolicy || "Consulte nossa equipe para informações sobre pedidos, pagamentos e alergênicos."}</p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl border-t border-white/10 pt-4 text-center text-[10px] text-stone-500">© {new Date().getFullYear()} {r.name}. Todos os direitos reservados.</p>
      </footer>
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto max-w-3xl">
            {showCart ? (
              <div className="mb-3 max-h-[55vh] space-y-3 overflow-y-auto rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShoppingBag className="size-4 text-brand" /> Seu pedido
                  </div>
                  <button type="button" aria-label="Fechar carrinho" onClick={() => setShowCart(false)} className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
                    <X className="size-4" />
                  </button>
                </div>
                <CartSummary cart={cart} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className={inputCls} type="tel" inputMode="tel" placeholder="WhatsApp (opcional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <input className={inputCls} placeholder="Observações do pedido" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
              </div>
            ) : null}
            <Btn
              className="w-full py-3"
              disabled={!r.isOpen || submitting}
              onClick={() => (showCart ? setConfirmOpen(true) : setShowCart(true))}
            >
              {showCart ? `Revisar e confirmar · ${brl(cartTotal(cart))}` : `Ver carrinho (${count}) · ${brl(cartTotal(cart))}`}
            </Btn>
          </div>
        </div>
      ) : null}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-0 p-0">
          <div className="p-6 sm:p-7">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Seu pedido está certinho?</DialogTitle>
              <DialogDescription>
                Confira os itens e quantidades antes de enviar para a cozinha.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-3">
              {cartItems(cart).map((item) => (
                <div key={item.productId} className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{brl(item.price)} cada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Remover uma unidade de ${item.name}`}
                      onClick={() => setItemQuantity(item.productId, -1)}
                      className="grid size-8 place-items-center rounded-full border border-stone-200 bg-white"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Adicionar uma unidade de ${item.name}`}
                      onClick={() => setItemQuantity(item.productId, 1)}
                      className="grid size-8 place-items-center rounded-full border border-stone-200 bg-white"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">{brl(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {recommendations.length ? (
              <section className="mt-6">
                <p className="text-sm font-semibold">Que tal uma bebida para acompanhar?</p>
                <div className="mt-2 space-y-2">
                  {recommendations.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-stone-100 p-2.5">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
                      ) : (
                        <div className="size-12 rounded-xl bg-stone-100" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-stone-500">{brl(product.price)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCart((previous) => changeQty(previous, product, 1)); setErr(""); }}
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
                      >
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-base font-bold">
              <span>Total do pedido</span>
              <span className="tabular-nums">{brl(cartTotal(cart))}</span>
            </div>
            {err ? <p role="alert" className="mt-3 text-sm text-red-600">{err}</p> : null}
            <div className="mt-5 grid gap-2">
              <Btn className="w-full py-3" disabled={submitting || count === 0 || !r.isOpen} onClick={() => void send()}>
                {submitting ? "Enviando..." : "Sim, enviar para a cozinha"}
              </Btn>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
              >
                Continuar escolhendo
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderTracking({
  data: order,
  error,
  onRefresh,
}: {
  data: ApiPublicOrderTracking | null;
  error: string;
  onRefresh: () => void;
}) {
  const status = order?.status;
  const cancelled = status === "CANCELADO";
  const ready = status === "ENTREGUE" || status === "SAIU_PARA_ENTREGA" || status === "FINALIZADO";
  const delivered = status === "FINALIZADO";
  const steps = [
    { label: "Recebido", active: Boolean(status) },
    { label: "Em preparo", active: status === "PREPARANDO" || ready },
    { label: delivered ? "Entregue" : status === "SAIU_PARA_ENTREGA" ? "A caminho" : "Pronto", active: ready },
  ];

  return (
    <section aria-live="polite" className="mb-8 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Acompanhe seu pedido</p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {cancelled ? "Pedido cancelado" : delivered ? "Pedido entregue!" : status === "SAIU_PARA_ENTREGA" ? "Seu pedido está a caminho" : status === "ENTREGUE" ? "Pedido pronto!" : "Estamos preparando tudo"}
          </h2>
          {order ? (
            <p className="mt-1 text-sm text-stone-500">
              Enviado às {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {brl(order.total)}
            </p>
          ) : null}
        </div>
        {status && status !== "ENTREGUE" && status !== "FINALIZADO" && status !== "CANCELADO" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <LoaderCircle className="size-3.5 animate-spin" /> Atualizado automaticamente
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Não foi possível atualizar agora. {error}
          <button type="button" onClick={onRefresh} className="ml-2 font-semibold underline">Tentar novamente</button>
        </p>
      ) : null}
      {order && !cancelled ? (
        <ol className="mt-6 grid grid-cols-3 gap-2">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex flex-col items-center gap-2 text-center">
              <span className={`grid size-9 place-items-center rounded-full ${step.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"}`}>
                {step.active ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
              </span>
              <span className={`text-xs font-medium ${step.active ? "text-stone-800" : "text-stone-400"}`}>{step.label}</span>
              {index < steps.length - 1 ? <span className={`absolute left-[calc(50%+24px)] top-4 h-0.5 w-[calc(100%-48px)] ${steps[index + 1].active ? "bg-emerald-300" : "bg-stone-100"}`} /> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {cancelled ? <XCircle className="mt-4 size-6 text-red-600" aria-label="Pedido cancelado" /> : null}
      {!order && !error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-stone-500">
          <Clock3 className="size-4" /> Carregando atualização do pedido...
        </p>
      ) : null}
    </section>
  );
}
