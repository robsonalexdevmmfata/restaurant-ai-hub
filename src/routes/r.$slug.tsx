import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { MenuHighlights } from "@/components/menu-highlights";

import logo from "@/assets/logo.png";
import {
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  TicketPercent,
  X,
  XCircle,
} from "lucide-react";
import { Btn, inputCls, useLoad } from "@/components/kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CartSummary,
  cartItems,
  cartTotal,
  changeQty,
  ProductPicker,
  type Cart,
} from "@/components/order-builder";
import { apiAssetUrl, brl, type ApiPublicOrderTracking } from "@/lib/api";
import { usePublicTenantCoupons, validateCoupon } from "@/lib/coupon-store";
import { data } from "@/lib/data";

export const Route = createFileRoute("/r/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    mesa: typeof s["mesa"] === "string" ? s["mesa"] : undefined,
    menu: typeof s["menu"] === "string" ? s["menu"] : undefined,
    pedido: typeof s["pedido"] === "string" ? s["pedido"] : undefined,
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
  const { coupons, error: couponLoadError } = usePublicTenantCoupons(slug);
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [couponNotice, setCouponNotice] = useState("");
  const faviconUrl = res.data?.restaurant.faviconUrl;

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

  const subtotal = cartTotal(cart);
  const couponPreview = validateCoupon(coupons, couponDraft, subtotal, 0, !mesa);
  const appliedCoupon = validateCoupon(coupons, appliedCouponCode, subtotal, 0, !mesa);
  const couponDiscount = appliedCoupon.valid ? appliedCoupon.discountAmount : 0;
  const orderTotal = Math.max(0, subtotal - couponDiscount);

  function applyCoupon() {
    if (!couponPreview.valid || !couponPreview.coupon) {
      setCouponNotice(couponPreview.error ?? "Informe um cupom válido.");
      return;
    }
    setAppliedCouponCode(couponPreview.coupon.code);
    setCouponNotice(`Cupom aplicado: economia de ${brl(couponPreview.discountAmount)}.`);
    setErr("");
  }

  function validateCustomerDetails() {
    if (name.trim().length < 2) {
      setErr("Informe seu nome para continuar.");
      return false;
    }
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setErr("Informe um WhatsApp válido com DDD.");
      return false;
    }
    if (appliedCouponCode && !appliedCoupon.valid) {
      setErr(appliedCoupon.error ?? "Este cupom não está mais disponível.");
      setAppliedCouponCode("");
      return false;
    }
    return true;
  }

  async function send() {
    if (!validateCustomerDetails()) return;
    setSubmitting(true);
    setErr("");
    try {
      const result = await data.publicOrder(slug, {
        ...(mesa ? { tableLabel: mesa } : {}),
        customerName: name.trim(),
        customerPhone: customerPhone.trim(),
        ...(appliedCoupon.valid ? { couponCode: appliedCoupon.coupon?.code } : {}),
        ...(notes ? { notes } : {}),
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
          const latestProducts = new Map(
            latestMenu.products.map((product) => [product.id, product]),
          );
          setCart((previous) => {
            const refreshed: Cart = {};
            for (const item of cartItems(previous)) {
              const latest = latestProducts.get(item.productId);
              if (latest)
                refreshed[item.productId] = {
                  ...item,
                  name: latest.name,
                  price: Number(latest.price),
                };
            }
            return refreshed;
          });
          setErr(
            `${message} Os itens disponíveis foram atualizados; revise o novo total e confirme novamente.`,
          );
        } catch (refreshError) {
          setErr(
            `${message} Não foi possível atualizar os preços agora. ${refreshError instanceof Error ? refreshError.message : ""}`,
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (res.error)
    return (
      <div className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center text-[14px] text-stone-600">
        {res.error}
      </div>
    );
  if (!res.data) return <div className="min-h-screen bg-stone-100" />;
  const loadedMenu = res.data;
  const r = loadedMenu.restaurant;
  const promotions = res.data.promotions ?? [];
  const count = cartItems(cart).reduce((a, i) => a + i.quantity, 0);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = res.data.products.filter(
    (product) =>
      !normalizedSearch ||
      `${product.name} ${product.description ?? ""} ${product.category ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch),
  );
  const containsDrink = cartItems(cart).some((item) =>
    /bebid|suco|refriger|água|agua|drink/i.test(
      loadedMenu.products.find((product) => product.id === item.productId)?.category ?? "",
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
    <div
      className={`public-store flex min-h-screen flex-col bg-menu-surface font-sans text-foreground ${count > 0 ? "pb-28" : ""}`}
      style={{ "--menu-brand": r.primaryColor } as CSSProperties}
    >
      <header className="border-b border-border bg-card">
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-stone-200 via-stone-100 to-emerald-50 sm:h-64">
          {r.coverUrl ? (
            <RestaurantCoverImage key={r.coverUrl} src={r.coverUrl} restaurantName={r.name} />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-start gap-4 px-4 pb-6 sm:gap-6 sm:px-8">
          <img
            src={apiAssetUrl(r.logoUrl) || logo}
            alt={`${r.name} logo`}
            onError={(event) => {
              event.currentTarget.src = logo;
            }}
            loading="eager"
            fetchPriority="high"
            className="-mt-8 size-20 shrink-0 rounded-2xl border-4 border-card bg-card object-cover shadow-md sm:-mt-10 sm:size-28"
          />
          <div className="min-w-0 flex-1 pt-2 sm:pt-4">
            <h1 className="break-words font-display text-xl font-semibold sm:text-3xl">{r.name}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:mt-2">
              {r.description ?? res.data.menu?.name ?? "Peça seus favoritos direto por aqui."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:mt-4">
              {mesa ? (
                <span className="menu-soft rounded-md px-3 py-1.5 font-semibold text-menu-brand">
                  {mesa}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${r.isOpen ? "text-menu-brand" : "text-destructive"}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {r.isOpen ? "Aberto agora" : "Fechado"}
              </span>
              {r.openingHours ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="size-3.5" /> {r.openingHours}
                </span>
              ) : null}
              {r.address ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5" /> {r.city ?? r.address}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <MenuHighlights slug={slug} promotions={promotions} />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        {done ? (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
          >
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Feito para você
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Escolha seus favoritos
            </h2>
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
          <ProductPicker
            products={visibleProducts}
            cart={cart}
            brandColor={r.primaryColor}
            onChange={(c) => {
              setCart(c);
              setDone(false);
              setErr("");
            }}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-500">
            {res.data.products.length
              ? "Nenhum produto encontrado para essa busca."
              : "Este cardápio ainda não tem produtos disponíveis."}
          </div>
        )}
      </main>
      <footer className="bg-ink px-5 py-8 text-stone-300 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2">
          <div>
            <p className="font-display text-lg font-semibold text-white">{r.name}</p>
            {r.address ? (
              <p className="mt-2 text-sm">
                {r.address}
                {r.city ? ` · ${r.city}` : ""}
                {r.state ? `/${r.state}` : ""}
              </p>
            ) : null}
            {r.openingHours ? (
              <p className="mt-1 text-sm">Funcionamento: {r.openingHours}</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-white">
              Informações e políticas
            </p>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-stone-400">
              {r.publicPolicy ||
                "Consulte nossa equipe para informações sobre pedidos, pagamentos e alergênicos."}
            </p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl border-t border-white/10 pt-4 text-center text-[10px] text-stone-500">
          © {new Date().getFullYear()} {r.name}. Todos os direitos reservados.
        </p>
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
                  <button
                    type="button"
                    aria-label="Fechar carrinho"
                    onClick={() => setShowCart(false)}
                    className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <CartSummary cart={cart} showTotal={false} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-stone-700">
                    Seu nome <span className="text-rose-600">*</span>
                    <input
                      className={inputCls}
                      placeholder="Como podemos te chamar?"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-stone-700">
                    WhatsApp com DDD <span className="text-rose-600">*</span>
                    <input
                      className={inputCls}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(11) 99999-9999"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Observações do pedido"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <TicketPercent className="size-4 text-amber-700" />
                    Tem cupom de desconto?
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`${inputCls} min-w-0 font-mono uppercase`}
                      aria-label="Código do cupom de desconto"
                      placeholder="Digite seu cupom"
                      value={couponDraft}
                      onChange={(event) => {
                        setCouponDraft(event.target.value.toLocaleUpperCase("pt-BR"));
                        setAppliedCouponCode("");
                        setCouponNotice("");
                      }}
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={!couponDraft.trim()}
                      className="shrink-0 rounded-xl bg-stone-900 px-4 text-xs font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Aplicar
                    </button>
                  </div>
                  {couponDraft.trim() ? (
                    <p
                      role="status"
                      className={`mt-2 text-xs ${couponPreview.valid ? "text-emerald-700" : "text-rose-600"}`}
                    >
                      {couponPreview.valid
                        ? `${couponPreview.coupon?.code} válido · ${brl(couponPreview.discountAmount)} de desconto.`
                        : couponPreview.error || couponLoadError || "Verificando cupom…"}
                    </p>
                  ) : couponNotice ? (
                    <p role="status" className="mt-2 text-xs text-emerald-700">
                      {couponNotice}
                    </p>
                  ) : null}
                  {couponLoadError && !couponDraft.trim() ? (
                    <p role="status" className="mt-2 text-xs text-rose-600">
                      {couponLoadError}
                    </p>
                  ) : null}
                </section>
                <div className="space-y-1 border-t border-stone-100 pt-3 text-sm">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span>{brl(subtotal)}</span>
                  </div>
                  {couponDiscount > 0 ? (
                    <div className="flex justify-between font-medium text-emerald-700">
                      <span>Desconto {appliedCoupon.coupon?.code}</span>
                      <span>− {brl(couponDiscount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1 font-bold text-stone-900">
                    <span>Total</span>
                    <span>{brl(orderTotal)}</span>
                  </div>
                </div>
                {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
              </div>
            ) : null}
            <Btn
              className="w-full py-3"
              disabled={!r.isOpen || submitting}
              onClick={() => {
                if (!showCart) {
                  setShowCart(true);
                  return;
                }
                if (validateCustomerDetails()) {
                  setErr("");
                  setConfirmOpen(true);
                }
              }}
            >
              {showCart
                ? `Revisar e confirmar · ${brl(orderTotal)}`
                : `Ver carrinho (${count}) · ${brl(orderTotal)}`}
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
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3"
                >
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
                    <span className="w-5 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Adicionar uma unidade de ${item.name}`}
                      onClick={() => setItemQuantity(item.productId, 1)}
                      className="grid size-8 place-items-center rounded-full border border-stone-200 bg-white"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">
                    {brl(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            {recommendations.length ? (
              <section className="mt-6">
                <p className="text-sm font-semibold">Que tal uma bebida para acompanhar?</p>
                <div className="mt-2 space-y-2">
                  {recommendations.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-2xl border border-stone-100 p-2.5"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="size-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="size-12 rounded-xl bg-stone-100" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-stone-500">{brl(product.price)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCart((previous) => changeQty(previous, product, 1));
                          setErr("");
                        }}
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
                      >
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="mt-6 space-y-2 border-t border-stone-100 pt-4 text-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(subtotal)}</span>
              </div>
              {couponDiscount > 0 ? (
                <div className="flex items-center justify-between font-medium text-emerald-700">
                  <span>Desconto {appliedCoupon.coupon?.code}</span>
                  <span className="tabular-nums">− {brl(couponDiscount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between pt-1 text-base font-bold text-stone-900">
                <span>Total do pedido</span>
                <span className="tabular-nums">{brl(orderTotal)}</span>
              </div>
            </div>
            {err ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {err}
              </p>
            ) : null}
            <div className="mt-5 grid gap-2">
              <Btn
                className="w-full py-3"
                disabled={submitting || count === 0 || !r.isOpen}
                onClick={() => void send()}
              >
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

function RestaurantCoverImage({ src, restaurantName }: { src: string; restaurantName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      src={apiAssetUrl(src)}
      alt={`Capa de ${restaurantName}`}
      loading="eager"
      fetchPriority="high"
      className="absolute inset-0 size-full object-cover"
      onError={() => setFailed(true)}
    />
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
    {
      label: delivered ? "Entregue" : status === "SAIU_PARA_ENTREGA" ? "A caminho" : "Pronto",
      active: ready,
    },
  ];

  return (
    <section
      aria-live="polite"
      className="mb-8 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Acompanhe seu pedido
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {cancelled
              ? "Pedido cancelado"
              : delivered
                ? "Pedido entregue!"
                : status === "SAIU_PARA_ENTREGA"
                  ? "Seu pedido está a caminho"
                  : status === "ENTREGUE"
                    ? "Pedido pronto!"
                    : "Estamos preparando tudo"}
          </h2>
          {order ? (
            <p className="mt-1 text-sm text-stone-500">
              Enviado às{" "}
              {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {brl(order.total)}
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
          <button type="button" onClick={onRefresh} className="ml-2 font-semibold underline">
            Tentar novamente
          </button>
        </p>
      ) : null}
      {order && !cancelled ? (
        <ol className="mt-6 grid grid-cols-3 gap-2">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex flex-col items-center gap-2 text-center">
              <span
                className={`grid size-9 place-items-center rounded-full ${step.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"}`}
              >
                {step.active ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-2 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-xs font-medium ${step.active ? "text-stone-800" : "text-stone-400"}`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`absolute left-[calc(50%+24px)] top-4 h-0.5 w-[calc(100%-48px)] ${steps[index + 1]?.active ? "bg-emerald-300" : "bg-stone-100"}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {cancelled ? (
        <XCircle className="mt-4 size-6 text-red-600" aria-label="Pedido cancelado" />
      ) : null}
      {!order && !error ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-stone-500">
          <Clock3 className="size-4" /> Carregando atualização do pedido...
        </p>
      ) : null}
    </section>
  );
}
