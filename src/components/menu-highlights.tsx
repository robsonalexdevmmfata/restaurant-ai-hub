import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Copy, TicketPercent } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Btn } from "@/components/kit";
import { apiAssetUrl, brl, type ApiPromotion } from "@/lib/api";
import { useTenantCoupons } from "@/lib/coupon-store";

function HighlightCarousel({ title, children }: { title: string; children: ReactNode }) {
  const [viewport, carousel] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  useEffect(() => {
    if (!carousel) return;
    const update = () => { setCanPrev(carousel.canScrollPrev()); setCanNext(carousel.canScrollNext()); };
    update();
    carousel.on("select", update).on("reInit", update);
    return () => { carousel.off("select", update).off("reInit", update); };
  }, [carousel]);
  return <section aria-label={title} className="mt-7">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="flex gap-2">
        <Btn variant="ghost" className="size-8 p-0" aria-label={`${title}: anterior`} title="Anterior" disabled={!canPrev} onClick={() => carousel?.scrollPrev()}><ChevronLeft className="size-4" /></Btn>
        <Btn variant="ghost" className="size-8 p-0" aria-label={`${title}: próximo`} title="Próximo" disabled={!canNext} onClick={() => carousel?.scrollNext()}><ChevronRight className="size-4" /></Btn>
      </div>
    </div>
    <div ref={viewport} className="overflow-hidden"><div className="-ml-3 flex touch-pan-y">{children}</div></div>
  </section>;
}

export function MenuHighlights({ slug, promotions }: { slug: string; promotions: ApiPromotion[] }) {
  const { coupons } = useTenantCoupons(slug);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const now = Date.now();
  const visibleCoupons = coupons.filter((coupon) => coupon.active && now >= new Date(coupon.startsAt).getTime() && now <= new Date(coupon.expiresAt).getTime() && (coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses));
  const visiblePromotions = promotions.filter((promotion) => promotion.isActive !== false);
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(code); setCopyError(""); }
    catch { setCopyError(`Copie o código: ${code}`); }
  }
  return <>
    {visiblePromotions.length > 0 && <HighlightCarousel title="Promoções da semana">
      {visiblePromotions.map((promotion) => <div key={promotion.id} className="min-w-0 shrink-0 basis-[92%] pl-3 sm:basis-1/2 lg:basis-1/3">
        <article className="overflow-hidden rounded-lg border border-border bg-card">
          <img src={apiAssetUrl(promotion.imageUrl)} alt={promotion.title || "Promoção do restaurante"} className="aspect-[16/9] w-full object-cover" />
          <div className="min-h-24 p-4"><h3 className="font-semibold">{promotion.title}</h3>{promotion.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{promotion.description}</p>}</div>
        </article>
      </div>)}
    </HighlightCarousel>}
    {visibleCoupons.length > 0 && <HighlightCarousel title="Cupons de desconto">
      {visibleCoupons.map((coupon) => <div key={coupon.id} className="min-w-0 shrink-0 basis-[90%] pl-3 sm:basis-1/2 lg:basis-1/3">
        <article className="menu-soft flex min-h-40 items-center gap-3 rounded-lg border border-menu-brand/20 p-4">
          <TicketPercent className="size-8 shrink-0 text-menu-brand" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">{coupon.kind === "percentual" ? `${coupon.value}% de desconto` : coupon.kind === "valor-fixo" ? `${brl(coupon.value)} de desconto` : "Frete grátis"}</h3>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-menu-brand">{coupon.code}</p>
            <p className="mt-1 text-xs text-muted-foreground">Válido até {new Date(coupon.expiresAt).toLocaleDateString("pt-BR")}</p>
            <Btn variant="ghost" className="mt-3 text-xs" onClick={() => void copy(coupon.code)}><Copy className="size-3.5" />{copied === coupon.code ? "Copiado!" : "Copiar código"}</Btn>
          </div>
        </article>
      </div>)}
    </HighlightCarousel>}
    <p role="status" className="mt-2 text-xs text-muted-foreground">{copyError}</p>
  </>;
}