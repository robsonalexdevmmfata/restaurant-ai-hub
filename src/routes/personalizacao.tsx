import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, Palette, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { api, apiAssetUrl, getToken } from "@/lib/api";
import { readImageAsDataUrl } from "@/lib/image-upload";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/personalizacao")({ component: RestaurantBranding });

function RestaurantBranding() {
  const { tenant, loading } = useRequireTenant("owner");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { branding, update } = useTenantBranding(slug);
  const [draft, setDraft] = useState(branding);
  const [saving, setSaving] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [publicPolicy, setPublicPolicy] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [logoImage, setLogoImage] = useState("");
  const [faviconImage, setFaviconImage] = useState("");
  const [coverImage, setCoverImage] = useState("");

  useEffect(() => setDraft(branding), [branding]);
  useEffect(() => {
    if (!getToken()) return;
    api.getRestaurant().then((restaurant) => {
      setDraft((current) => ({
        ...current,
        logoUrl: restaurant.logoUrl ?? "",
        primaryColor: restaurant.primaryColor,
        faviconUrl: restaurant.faviconUrl ?? "",
        cnpj: restaurant.cnpj ?? "",
      }));
      setCoverUrl(restaurant.coverUrl ?? "");
      setWebhookUrl(restaurant.webhookUrl ?? "");
      setPublicPolicy(restaurant.publicPolicy ?? "");
      setOpeningHours(restaurant.openingHours ?? "");
      setAddress(restaurant.address ?? "");
      setCity(restaurant.city ?? "");
      setStateName(restaurant.state ?? "");
    }).catch((error: unknown) => {
      showToast({
        title: "Não foi possível carregar a identidade visual",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "warning",
      });
    });
  }, [slug]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = `${origin}/r/${tenant.restaurantSlug}`;

  async function readBrandImage(event: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "favicon" | "cover") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const image = await readImageAsDataUrl(file);
      if (kind === "logo") setLogoImage(image);
      else if (kind === "favicon") setFaviconImage(image);
      else setCoverImage(image);
    } catch (error) {
      showToast({ title: "Arquivo não aceito", description: error instanceof Error ? error.message : "Escolha uma imagem válida.", variant: "warning" });
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast({ title: "Link copiado", description: "O endereço público do cardápio está na área de transferência.", variant: "success" });
    } catch {
      showToast({ title: "Não foi possível copiar", description: publicUrl, variant: "warning" });
    }
  }

  async function saveBranding(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    let restaurantSaved = false;
    try {
      if (!getToken()) {
        showToast({ title: "Conecte o backend para salvar", description: "A identidade visual só pode ser persistida com uma sessão autenticada.", variant: "warning" });
        return;
      }
      const restaurant = await api.updateRestaurant({
        primaryColor: draft.primaryColor,
        cnpj: draft.cnpj || null,
        webhookUrl: webhookUrl.trim() || null,
        publicPolicy: publicPolicy.trim() || null,
        openingHours: openingHours.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
      });
      restaurantSaved = true;
      let logoUrl = restaurant.logoUrl ?? "";
      let faviconUrl = restaurant.faviconUrl ?? "";
      let savedCoverUrl = restaurant.coverUrl ?? "";
      if (logoImage) logoUrl = (await api.uploadRestaurantLogo(logoImage)).logoUrl ?? "";
      if (faviconImage) faviconUrl = (await api.uploadRestaurantAsset("favicon", faviconImage)).faviconUrl ?? "";
      if (coverImage) savedCoverUrl = (await api.uploadRestaurantAsset("cover", coverImage)).coverUrl ?? "";
      update({
        ...draft,
        logoUrl,
        primaryColor: restaurant.primaryColor,
        faviconUrl,
        cnpj: restaurant.cnpj ?? "",
      });
      setCoverUrl(savedCoverUrl);
      setLogoImage("");
      setFaviconImage("");
      setCoverImage("");
      showToast({ title: "Identidade visual salva", description: "As alterações foram persistidas e o cardápio público será atualizado.", variant: "success" });
    } catch (error) {
      showToast({
        title: restaurantSaved ? "Personalização salva parcialmente" : "Não foi possível salvar a identidade visual",
        description: restaurantSaved
          ? `Os campos foram salvos, mas uma ou mais imagens não foram atualizadas: ${error instanceof Error ? error.message : "Tente enviar a imagem novamente."}`
          : error instanceof Error ? error.message : "Tente novamente.",
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
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

            <section className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Logo", image: logoImage || draft.logoUrl, kind: "logo" as const },
                { label: "Favicon", image: faviconImage || draft.faviconUrl, kind: "favicon" as const },
                { label: "Capa do restaurante", image: coverImage || coverUrl, kind: "cover" as const },
              ].map((asset) => (
                <label key={asset.kind} className="cursor-pointer rounded-md border border-black/10 p-3 text-[11px] font-medium text-stone-600 hover:border-brand/40">
                  <span className="block">{asset.label} · imagem até 1 MB</span>
                  {asset.image ? <img src={apiAssetUrl(asset.image)} alt={`Prévia: ${asset.label}`} className="mt-2 h-20 w-full rounded object-cover" /> : <span className="mt-2 grid h-20 place-items-center rounded bg-stone-50 text-stone-400">Selecionar imagem</span>}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void readBrandImage(event, asset.kind)}
                    className="sr-only"
                  />
                </label>
              ))}
            </section>

            <label className="block text-[12px] font-medium text-stone-600">
              CNPJ para recibos
              <input value={draft.cnpj} onChange={(event) => setDraft((current) => ({ ...current, cnpj: event.target.value }))} placeholder="00.000.000/0000-00" className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink outline-none focus:ring-2 focus:ring-brand/30" />
            </label>

            <section className="space-y-3 rounded-md border border-black/10 p-3">
              <p className="text-[12px] font-semibold">Informações exibidas no cardápio público</p>
              <label className="block text-[11px] font-medium text-stone-600">Horário de funcionamento<input value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} maxLength={500} placeholder="Seg–Dom · 18h às 23h" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-[11px] font-medium text-stone-600 sm:col-span-1">Endereço<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} placeholder="Rua, número e bairro" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
                <label className="text-[11px] font-medium text-stone-600">Cidade<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
                <label className="text-[11px] font-medium text-stone-600">Estado<input value={stateName} onChange={(event) => setStateName(event.target.value)} maxLength={60} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              </div>
              <label className="block text-[11px] font-medium text-stone-600">Políticas e avisos<textarea value={publicPolicy} onChange={(event) => setPublicPolicy(event.target.value)} maxLength={2000} rows={3} placeholder="Informações de pagamento, alergênicos, privacidade ou outras políticas." className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
            </section>

            <section className="space-y-2 rounded-md border border-black/10 p-3">
              <p className="text-[12px] font-semibold">Automação n8n</p>
              <p className="text-[10px] text-stone-500">O endpoint recebe eventos de pedidos e solicitações de conta. A URL fica privada e é usada somente pelo backend.</p>
              <label className="block text-[11px] font-medium text-stone-600">URL do webhook<input type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} maxLength={2048} placeholder="https://n8n.exemplo.com/webhook/restaurant" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px]" /></label>
              <p className="text-[10px] text-stone-500">Evolution API deve ser configurada no servidor; a chave nunca é exposta nesta tela.</p>
            </section>

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

            <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-deep disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando..." : "Salvar personalização"}</button>
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
                {logoImage || draft.logoUrl ? <img src={apiAssetUrl(logoImage || draft.logoUrl)} alt="Logo do restaurante" className="size-12 rounded-md object-contain" /> : <span className="grid size-12 place-items-center rounded-md bg-white text-stone-400 ring-1 ring-black/5"><Store className="size-5" /></span>}
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
