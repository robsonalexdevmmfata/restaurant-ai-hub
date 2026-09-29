import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, ImagePlus, Palette, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/personalizacao")({ component: RestaurantBranding });

function RestaurantBranding() {
  const { tenant, loading } = useRequireTenant("owner");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { branding, update } = useTenantBranding(slug);
  const [draft, setDraft] = useState(branding);

  useEffect(() => setDraft(branding), [branding]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = `${origin}/cardapio/${tenant.restaurantSlug}`;

  function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/[.](png|jpe?g|webp)$/i.test(file.name) || file.size > 1_000_000) {
      showToast({ title: "Arquivo não aceito", description: "Use PNG, JPG ou WebP com até 1 MB.", variant: "warning" });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, logoUrl: String(reader.result ?? "") }));
    reader.readAsDataURL(file);
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast({ title: "Link copiado", description: "O endereço público do cardápio está na área de transferência.", variant: "success" });
    } catch {
      showToast({ title: "Não foi possível copiar", description: publicUrl, variant: "warning" });
    }
  }

  function saveBranding(event: React.FormEvent) {
    event.preventDefault();
    update(draft);
    showToast({ title: "Identidade visual salva", description: "O cardápio público já usa as novas configurações.", variant: "success" });
  }

  return (
    <AppShell tenant={tenant} title="Personalização do restaurante" subtitle={`${tenant.restaurant} · marca e cardápio público`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-[13px] font-semibold">Identidade visual do cardápio</p>
            <p className="mt-1 text-[12px] text-stone-500">As alterações são isoladas para este restaurante.</p>
          </div>
          <form onSubmit={saveBranding} className="space-y-4">
            <label className="flex items-center gap-3 rounded-md border border-black/10 p-3">
              <input
                type="color"
                value={draft.primaryColor}
                onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))}
                className="size-11 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Cor principal do cardápio"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold">Cor principal</span>
                <span className="block text-[11px] text-stone-500">Usada em botões e destaques do cardápio público.</span>
              </span>
              <span className="font-mono text-[11px] uppercase text-stone-500">{draft.primaryColor}</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-stone-600">
                Logo por URL
                <input value={draft.logoUrl.startsWith("data:") ? "" : draft.logoUrl} onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="https://.../logo.png" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink outline-none focus:ring-2 focus:ring-brand/30" />
              </label>
              <label className="block text-[12px] font-medium text-stone-600">
                Favicon por URL
                <input value={draft.faviconUrl} onChange={(event) => setDraft((current) => ({ ...current, faviconUrl: event.target.value }))} placeholder="https://.../favicon.png" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink outline-none focus:ring-2 focus:ring-brand/30" />
              </label>
            </div>

            <label className="block text-[12px] font-medium text-stone-600">
              CNPJ para recibos
              <input value={draft.cnpj} onChange={(event) => setDraft((current) => ({ ...current, cnpj: event.target.value }))} placeholder="00.000.000/0000-00" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink outline-none focus:ring-2 focus:ring-brand/30" />
            </label>

            <section className="space-y-3 rounded-md border border-black/10 p-3">
              <div>
                <p className="text-[12px] font-semibold">Logística e Taxas de Entrega</p>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-500">A mesma regra calcula a estimativa do cliente, o valor da rota e o repasse do motoboy.</p>
              </div>
              <label className="block text-[11px] font-medium text-stone-600">
                Modelo de cálculo
                <select
                  value={draft.deliveryFees.model}
                  onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, model: event.target.value as typeof current.deliveryFees.model } }))}
                  className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"
                >
                  <option value="bairro">Taxa fixa por bairro</option>
                  <option value="quilometro">Valor por quilômetro</option>
                  <option value="base-excedente">Taxa base + KM excedente</option>
                </select>
              </label>
              {draft.deliveryFees.model === "bairro" ? (
                <div className="space-y-2">
                  {draft.deliveryFees.neighborhoodFees.map((rule, index) => (
                    <div key={`${rule.neighborhood}-${index}`} className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2">
                      <input value={rule.neighborhood} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, neighborhoodFees: current.deliveryFees.neighborhoodFees.map((item, itemIndex) => itemIndex === index ? { ...item, neighborhood: event.target.value } : item) } }))} aria-label="Nome do bairro" placeholder="Bairro" className="min-w-0 rounded-md border border-black/10 bg-white px-2 py-2 text-[11px]" />
                      <input type="number" min="0" step="0.01" value={rule.fee} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, neighborhoodFees: current.deliveryFees.neighborhoodFees.map((item, itemIndex) => itemIndex === index ? { ...item, fee: Number(event.target.value) || 0 } : item) } }))} aria-label={`Taxa para ${rule.neighborhood}`} className="w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[11px]" />
                      <button type="button" onClick={() => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, neighborhoodFees: current.deliveryFees.neighborhoodFees.filter((_, itemIndex) => itemIndex !== index) } }))} aria-label={`Remover bairro ${rule.neighborhood}`} className="rounded-md border border-black/10 px-2 text-[11px] text-stone-500 hover:bg-stone-50">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, neighborhoodFees: [...current.deliveryFees.neighborhoodFees, { neighborhood: "", fee: 0 }] } }))} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50">Adicionar bairro</button>
                  <label className="block text-[11px] font-medium text-stone-600">
                    Taxa padrão para bairros sem regra (R$)
                    <input type="number" min="0" step="0.01" value={draft.deliveryFees.baseFee} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, baseFee: Number(event.target.value) || 0 } }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
                  </label>
                </div>
              ) : draft.deliveryFees.model === "quilometro" ? (
                <label className="block text-[11px] font-medium text-stone-600">
                  Valor por quilômetro (R$/km)
                  <input type="number" min="0" step="0.01" value={draft.deliveryFees.perKmRate} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, perKmRate: Number(event.target.value) || 0 } }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" />
                </label>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-[10px] font-medium text-stone-600">Taxa base (R$)<input type="number" min="0" step="0.01" value={draft.deliveryFees.baseFee} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, baseFee: Number(event.target.value) || 0 } }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[11px]" /></label>
                  <label className="text-[10px] font-medium text-stone-600">KM incluídos<input type="number" min="0" step="0.1" value={draft.deliveryFees.includedKm} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, includedKm: Number(event.target.value) || 0 } }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[11px]" /></label>
                  <label className="text-[10px] font-medium text-stone-600">R$/KM extra<input type="number" min="0" step="0.01" value={draft.deliveryFees.extraKmRate} onChange={(event) => setDraft((current) => ({ ...current, deliveryFees: { ...current.deliveryFees, extraKmRate: Number(event.target.value) || 0 } }))} className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-[11px]" /></label>
                </div>
              )}
            </section>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-black/15 px-3 py-3 text-[12px] font-medium text-stone-600 transition hover:border-brand/40 hover:bg-emerald-50/40">
              <ImagePlus className="size-4" /> Enviar arquivo da logo (PNG, JPG ou WebP · até 1 MB)
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} className="sr-only" />
            </label>

            <button type="submit" className="rounded-md bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-deep">Salvar personalização</button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-brand" />
              <p className="text-[13px] font-semibold">Prévia da marca</p>
            </div>
            <div className="mt-4 rounded-lg bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo do restaurante" className="size-12 rounded-md object-contain" /> : <span className="grid size-12 place-items-center rounded-md bg-white text-stone-400 ring-1 ring-black/5"><Store className="size-5" /></span>}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{tenant.restaurant}</p>
                  <p className="text-[11px] text-stone-500">Cardápio digital</p>
                </div>
              </div>
              <button type="button" style={{ backgroundColor: draft.primaryColor }} className="mt-4 w-full rounded-md px-3 py-2 text-[12px] font-semibold text-white">Ver cardápio</button>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-[13px] font-semibold">Link público do cardápio</p>
            <p className="mt-1 text-[11px] text-stone-500">Identificador do restaurante: <span className="font-medium text-stone-700">{tenant.restaurantSlug}</span></p>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-stone-50 p-2">
              <code className="min-w-0 flex-1 break-all text-[11px] text-stone-700">{publicUrl}</code>
              <button type="button" onClick={copyPublicLink} title="Copiar link" aria-label="Copiar link público" className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-stone-700 ring-1 ring-black/10 hover:bg-stone-100"><Copy className="size-4" /></button>
            </div>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline">Abrir cardápio público <ExternalLink className="size-3.5" /></a>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
