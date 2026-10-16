import { createFileRoute } from "@tanstack/react-router";
import { Check, ImagePlus, Printer, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Btn, Field, PageGate, inputCls } from "@/components/kit";
import { readImageAsDataUrl } from "@/lib/image-upload";
import { useTenantBranding } from "@/lib/tenant-branding";
import { convertThermalLogo, saveThermalSettings, useThermalSettings } from "@/lib/thermal-settings";
import { printThermalReceipt, renderThermalReceipt, useThermalPaperWidth, type ThermalReceipt } from "@/lib/thermal-print";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/impressora")({
  head: () => ({ meta: [
    { title: "Impressora térmica — RestauranteAI" },
    { name: "description", content: "Personalize a logo e o recibo térmico do seu restaurante e visualize antes de imprimir." },
    { property: "og:title", content: "Impressora térmica — RestauranteAI" },
    { property: "og:description", content: "Configuração de bobina, logo em preto e branco e agradecimento do recibo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PrinterSettings,
});

function PrinterSettings() {
  const { tenant, loading } = useRequireTenant("owner");
  const slug = tenant?.restaurantSlug ?? "";
  const { branding } = useTenantBranding(slug);
  const settings = useThermalSettings(slug);
  const { paperWidth, setPaperWidth } = useThermalPaperWidth(slug);
  const [draft, setDraft] = useState(settings);
  const [source, setSource] = useState("");
  const [threshold, setThreshold] = useState(180);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createdAt, setCreatedAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => setCreatedAt(new Date().toLocaleString("pt-BR")), []);
  useEffect(() => {
    if (!source) return;
    let active = true;
    setBusy(true);
    convertThermalLogo(source, threshold).then((logo) => {
      if (active) { setDraft((value) => ({ ...value, logo })); setSaved(false); }
    }).catch(() => {
      if (active) showToast({ title: "Não foi possível converter a logo", variant: "error" });
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [source, threshold]);

  if (loading || !tenant) return <PageGate />;
  if (tenant.role !== "owner" && tenant.role !== "gerente") return <PageGate />;

  const receipt: ThermalReceipt = {
    kind: "sale", restaurant: branding.displayName || tenant.restaurant, restaurantSlug: slug,
    cnpj: branding.cnpj, documentId: "EXEMPLO-001", operator: tenant.name, createdAt,
    items: [{ name: "Prato do dia (exemplo)", quantity: 2, unitPrice: 25 }, { name: "Bebida (exemplo)", quantity: 1, unitPrice: 8 }],
    subtotal: 58, total: 58, paymentMethod: "PIX",
  };
  function save() {
    try {
      saveThermalSettings(slug, draft);
      setSaved(true);
      showToast({ title: "Configuração salva neste navegador", variant: "success" });
    } catch { showToast({ title: "Não foi possível salvar", description: "O armazenamento deste navegador está indisponível ou cheio.", variant: "error" }); }
  }

  return <AppShell tenant={tenant} title="Impressora térmica" subtitle={`${tenant.restaurant} · recibos e comprovantes`} action={
    <Btn onClick={save} disabled={busy}>{saved ? <Check className="size-4" /> : <Save className="size-4" />}{saved ? "Salvo" : "Salvar"}</Btn>
  }>
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-7">
        <section className="border-b border-border pb-7">
          <h2 className="font-display text-base font-semibold">Papel e impressão</h2>
          <div className="mt-4 max-w-sm"><Field label="Largura da bobina"><select aria-label="Largura da bobina" className={inputCls} value={paperWidth} onChange={(e) => setPaperWidth(e.target.value === "58mm" ? "58mm" : "80mm")}><option value="80mm">80 mm</option><option value="58mm">58 mm</option></select></Field></div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Impressão pelo diálogo do sistema. Selecione a impressora instalada e a mesma largura de papel.</p>
        </section>
        <section className="border-b border-border pb-7">
          <h2 className="font-display text-base font-semibold">Logo no recibo</h2>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar logo do recibo" className="sr-only" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try { setSource(await readImageAsDataUrl(file)); } catch (error) { showToast({ title: "Imagem inválida", description: error instanceof Error ? error.message : "Escolha outra imagem.", variant: "error" }); }
            e.target.value = "";
          }} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="grid size-24 shrink-0 place-items-center rounded-md border border-border bg-card">
              {draft.logo ? <img src={draft.logo} alt="Logo em preto e branco" className="max-h-20 max-w-20 object-contain" /> : <ImagePlus className="size-7 text-muted-foreground" />}
            </div>
            <div className="space-y-2"><Btn variant="ghost" onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" />Enviar logo</Btn><p className="text-xs text-muted-foreground">PNG, JPG ou WebP · até 1 MB</p></div>
            {draft.logo && <Btn variant="ghost" aria-label="Remover logo" title="Remover logo" onClick={() => { setSource(""); setDraft((v) => ({ ...v, logo: "" })); setSaved(false); }}><Trash2 className="size-4" /></Btn>}
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.showLogo} onChange={(e) => { setDraft((v) => ({ ...v, showLogo: e.target.checked })); setSaved(false); }} />Incluir logo na impressão</label>
          {source && <div className="mt-4 max-w-sm"><label htmlFor="logo-contrast" className="text-xs font-medium">Intensidade do preto</label><input id="logo-contrast" className="mt-2 w-full accent-brand" type="range" min="60" max="240" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></div>}
        </section>
        <section>
          <h2 className="mb-4 font-display text-base font-semibold">Mensagem final</h2>
          <Field label="Texto de agradecimento"><textarea aria-label="Texto de agradecimento" rows={3} className={`${inputCls} resize-y`} value={draft.footer} onChange={(e) => { setDraft((v) => ({ ...v, footer: e.target.value })); setSaved(false); }} /></Field>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Configuração salva por restaurante neste navegador. Recibo não fiscal; não substitui nota fiscal.</p>
        </section>
      </div>
      <section className="min-w-0 rounded-lg border border-border bg-muted/40 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Prévia do recibo</h2><span className="text-xs text-muted-foreground">{paperWidth === "80mm" ? "80 mm" : "58 mm"} · exemplo</span></div>
        <iframe title="Prévia da impressão térmica" sandbox="" srcDoc={renderThermalReceipt(receipt, paperWidth, draft)} className="mx-auto h-[580px] w-full border-0 bg-card" />
        <Btn className="mt-4 w-full" disabled={busy} onClick={() => { if (!printThermalReceipt(receipt, paperWidth, draft)) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para imprimir o recibo.", variant: "warning" }); }}><Printer className="size-4" />Imprimir teste</Btn>
      </section>
    </div>
  </AppShell>;
}