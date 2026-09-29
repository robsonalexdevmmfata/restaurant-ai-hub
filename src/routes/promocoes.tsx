import { createFileRoute } from "@tanstack/react-router";
import { Tag, TicketPercent } from "lucide-react";
import { useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
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
  const [form, setForm] = useState({
    code: "",
    kind: "percentual" as CouponKind,
    value: "10",
    startsAt: localInputDate(new Date()),
    expiresAt: localInputDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    maxUses: "100",
  });

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

  const couponKindLabel = (kind: CouponKind) => kind === "percentual" ? "Desconto percentual" : kind === "valor-fixo" ? "Desconto em reais" : "Frete grátis";
  const couponValueLabel = (kind: CouponKind, value: number) => kind === "percentual" ? `${value}%` : kind === "valor-fixo" ? brl(value) : "Entrega grátis";

  return (
    <AppShell tenant={tenant} title="Promoções / Cupons" subtitle={`${tenant.restaurant} · campanhas e impacto financeiro`}>
      <div className="space-y-4">
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
