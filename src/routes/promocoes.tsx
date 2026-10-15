import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Tag, TicketPercent, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { api, apiAssetUrl, type ApiPromotion } from "@/lib/api";
import { readImageAsDataUrl } from "@/lib/image-upload";
import { brl } from "@/lib/mock";
import { useTenantOperations } from "@/lib/operations";
import { useTenantCoupons, type CouponKind } from "@/lib/coupon-store";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

const localInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const Route = createFileRoute("/promocoes")({ component: Promotions });

function Promotions() {
  const { tenant, loading } = useRequireTenant("owner");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { coupons, update } = useTenantCoupons(slug);
  const { operations } = useTenantOperations(slug);
  const [banners, setBanners] = useState<ApiPromotion[]>([]);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerDescription, setBannerDescription] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [form, setForm] = useState({
    code: "",
    kind: "percentual" as CouponKind,
    value: "10",
    startsAt: localInputDate(new Date()),
    expiresAt: localInputDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    maxUses: "100",
  });

  useEffect(() => {
    let active = true;
    void api.listPromotions()
      .then((items) => { if (active) setBanners(items); })
      .catch((error: unknown) => {
        if (active) showToast({ title: "Não foi possível carregar os banners", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
      })
      .finally(() => { if (active) setLoadingBanners(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const couponOrders = operations.orders.filter((order) => order.paymentStatus === "Pago" && order.couponCode);
  const couponGross = couponOrders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.qty * item.price, 0) + (order.deliveryFee ?? 0), 0);
  const couponDiscounts = couponOrders.reduce((total, order) => total + (order.couponDiscount ?? 0), 0);
  const couponNet = couponGross - couponDiscounts;
  const now = Date.now();

  function createCoupon(event: React.FormEvent) {
    event.preventDefault();
    const code = form.code.trim().toLocaleUpperCase("pt-BR");
    const value = form.kind === "frete-gratis" ? 0 : Number(form.value.replace(",", "."));
    const maxUses = Math.max(0, Number(form.maxUses) || 0);
    if (!code || (form.kind !== "frete-gratis" && (!Number.isFinite(value) || value <= 0)) || new Date(form.expiresAt) <= new Date(form.startsAt)) {
      showToast({ title: "Confira os dados", description: "Informe código, valor e um período válido para a campanha.", variant: "warning" });
      return;
    }
    if (coupons.some((coupon) => coupon.code === code)) {
      showToast({ title: "Código já cadastrado", description: "Cada cupom precisa ter um código único.", variant: "warning" });
      return;
    }
    update((current) => [{
      id: `coupon-${Date.now()}`,
      code,
      kind: form.kind,
      value,
      startsAt: new Date(form.startsAt).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      maxUses,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    }, ...current]);
    setForm((current) => ({ ...current, code: "" }));
    showToast({ title: "Cupom criado", description: `${code} está disponível para os clientes.`, variant: "success" });
  }

  async function createBanner(event: React.FormEvent) {
    event.preventDefault();
    if (!bannerImage) {
      showToast({ title: "Escolha uma imagem", description: "O banner promocional precisa ter uma imagem.", variant: "warning" });
      return;
    }
    setSavingBanner(true);
    try {
      await api.createPromotion({
        title: bannerTitle.trim(),
        description: bannerDescription.trim() || undefined,
        image: bannerImage,
      });
      setBanners(await api.listPromotions());
      setBannerTitle("");
      setBannerDescription("");
      setBannerImage("");
      showToast({ title: "Banner publicado", description: "A promoção já pode aparecer no cardápio público.", variant: "success" });
    } catch (error) {
      showToast({ title: "Não foi possível salvar o banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
    } finally {
      setSavingBanner(false);
    }
  }

  async function removeBanner(id: number) {
    try {
      await api.deletePromotion(id);
      setBanners((current) => current.filter((banner) => banner.id !== id));
      showToast({ title: "Banner removido", description: "Ele não será mais exibido no cardápio.", variant: "success" });
    } catch (error) {
      showToast({ title: "Não foi possível remover o banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
    }
  }

  const couponKindLabel = (kind: CouponKind) => kind === "percentual" ? "Desconto percentual" : kind === "valor-fixo" ? "Desconto em reais" : "Frete grátis";
  const couponValueLabel = (kind: CouponKind, value: number) => kind === "percentual" ? `${value}%` : kind === "valor-fixo" ? brl(value) : "Entrega grátis";

  return (
    <AppShell tenant={tenant} title="Promoções / Cupons" subtitle={`${tenant.restaurant} · campanhas e impacto financeiro`}>
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="text-[13px] font-semibold">Banners do cardápio</p>
            <p className="mt-1 text-[11px] text-stone-500">Imagens promocionais persistidas e exibidas no carrossel público do restaurante.</p>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {loadingBanners ? <p className="text-[12px] text-stone-500">Carregando banners…</p> : null}
              {!loadingBanners && banners.length === 0 ? <p className="text-[12px] text-stone-500">Ainda não há banners. Cadastre um para destacá-lo no cardápio.</p> : null}
              {banners.map((banner) => (
                <article key={banner.id} className="overflow-hidden rounded-lg border border-black/10">
                  <img src={apiAssetUrl(banner.imageUrl)} alt={banner.title ?? "Banner promocional"} className="h-32 w-full object-cover" />
                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0"><p className="truncate text-[12px] font-semibold">{banner.title}</p><p className="mt-1 line-clamp-2 text-[10px] text-stone-500">{banner.description}</p></div>
                    <button type="button" onClick={() => void removeBanner(banner.id)} aria-label={`Remover banner ${banner.title}`} className="rounded-md p-2 text-stone-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
                  </div>
                </article>
              ))}
            </div>
            <form onSubmit={(event) => void createBanner(event)} className="space-y-3 rounded-lg bg-stone-50 p-3">
              <p className="text-[12px] font-semibold">Novo banner</p>
              <label className="block text-[11px] font-medium text-stone-600">Título<input required maxLength={120} value={bannerTitle} onChange={(event) => setBannerTitle(event.target.value)} placeholder="Oferta da semana" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              <label className="block text-[11px] font-medium text-stone-600">Descrição curta<input maxLength={280} value={bannerDescription} onChange={(event) => setBannerDescription(event.target.value)} placeholder="Desconto especial em pizzas selecionadas" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-black/15 bg-white px-3 py-3 text-[11px] font-medium text-stone-600 hover:border-brand/40">
                <ImagePlus className="size-4" /> Enviar imagem · JPG, PNG ou WebP · até 1 MB
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void readImageAsDataUrl(file).then(setBannerImage).catch((error: unknown) => {
                    showToast({ title: "Imagem não aceita", description: error instanceof Error ? error.message : "Escolha uma imagem válida.", variant: "warning" });
                  });
                }} />
              </label>
              {bannerImage ? <img src={bannerImage} alt="Prévia do novo banner" className="h-32 w-full rounded object-cover" /> : null}
              <button type="submit" disabled={savingBanner} className="w-full rounded-md bg-brand px-3 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60">{savingBanner ? "Publicando…" : "Publicar banner"}</button>
            </form>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Vendas com cupom", String(couponOrders.length)],
            ["Descontos concedidos", brl(couponDiscounts)],
            ["Receita líquida com cupom", brl(couponNet)],
          ].map(([label, value]) => <Card key={label} className="p-4"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 font-display text-xl font-semibold">{value}</p></Card>)}
        </div>
        <p className="text-[11px] text-stone-500">Faturamento bruto associado a cupons: <strong className="text-stone-700">{brl(couponGross)}</strong> · ROI sobre desconto: <strong className="text-stone-700">{couponDiscounts > 0 ? `${((couponNet / couponDiscounts) * 100).toFixed(0)}%` : "—"}</strong></p>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3"><div><p className="text-[13px] font-semibold">Cupons cadastrados</p><p className="mt-1 text-[11px] text-stone-500">{coupons.length} campanhas neste restaurante</p></div><Tag className="size-4 text-brand" /></div>
            {coupons.length ? <div className="divide-y divide-black/5">{coupons.map((coupon) => {
              const activeByDate = now >= new Date(coupon.startsAt).getTime() && now <= new Date(coupon.expiresAt).getTime();
              const exhausted = coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;
              return <article key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="font-mono text-[13px] font-bold tracking-wide">{coupon.code}</p><p className="mt-1 text-[11px] text-stone-500">{couponKindLabel(coupon.kind)} · {couponValueLabel(coupon.kind, coupon.value)}</p><p className="mt-1 text-[10px] text-stone-400">{new Date(coupon.startsAt).toLocaleDateString("pt-BR")}–{new Date(coupon.expiresAt).toLocaleDateString("pt-BR")} · {coupon.usedCount}/{coupon.maxUses || "∞"} usos</p></div>
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${coupon.active && activeByDate && !exhausted ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{!coupon.active ? "Pausado" : exhausted ? "Esgotado" : activeByDate ? "Ativo" : "Agendado/expirado"}</span><button type="button" onClick={() => update((current) => current.map((item) => item.id === coupon.id ? { ...item, active: !item.active } : item))} className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[10px] font-medium text-stone-700 hover:bg-stone-50">{coupon.active ? "Pausar" : "Ativar"}</button></div>
              </article>;
            })}</div> : <p className="p-6 text-center text-[12px] text-stone-500">Nenhum cupom criado ainda.</p>}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2"><TicketPercent className="size-4 text-brand" /><p className="text-[13px] font-semibold">Nova campanha</p></div>
            <form onSubmit={createCoupon} className="mt-4 space-y-3">
              <label className="block text-[11px] font-medium text-stone-600">Código promocional<input required value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))} placeholder="BEMVINDO10" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-mono" /></label>
              <label className="block text-[11px] font-medium text-stone-600">Tipo de desconto<select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as CouponKind }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]"><option value="percentual">Percentual (%)</option><option value="valor-fixo">Valor fixo (R$)</option><option value="frete-gratis">Frete grátis</option></select></label>
              {form.kind !== "frete-gratis" && <label className="block text-[11px] font-medium text-stone-600">{form.kind === "percentual" ? "Percentual" : "Valor em reais"}<input required min="0.01" max={form.kind === "percentual" ? 100 : undefined} step="0.01" type="number" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>}
              <div className="grid grid-cols-2 gap-2"><label className="block text-[10px] font-medium text-stone-600">Início<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[10px]" /></label><label className="block text-[10px] font-medium text-stone-600">Validade até<input required type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[10px]" /></label></div>
              <label className="block text-[11px] font-medium text-stone-600">Limite de usos (0 = ilimitado)<input min="0" step="1" type="number" value={form.maxUses} onChange={(event) => setForm((current) => ({ ...current, maxUses: event.target.value }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              <button type="submit" className="w-full rounded-md bg-brand px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-deep">Criar cupom</button>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
