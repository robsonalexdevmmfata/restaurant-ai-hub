import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Copy, TicketPercent } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Btn } from "@/components/kit";
import { apiAssetUrl, brl, type ApiPromotion } from "@/lib/api";
import { usePublicTenantCoupons } from "@/lib/coupon-store";

function HighlightCarousel({ title, children }: { title: string; children: ReactNode }) {
  const [viewport, carousel] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  useEffect(() => {
    if (!carousel) return;
    const update = () => {
      setCanPrev(carousel.canScrollPrev());
      setCanNext(carousel.canScrollNext());
      setSelectedSnap(carousel.selectedScrollSnap());
      setSnapCount(carousel.scrollSnapList().length);
    };
    update();
    carousel.on("select", update).on("reInit", update);
    return () => {
      carousel.off("select", update).off("reInit", update);
    };
  }, [carousel]);
  useEffect(() => {
    if (
      !carousel ||
      snapCount < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      if (carousel.selectedScrollSnap() === carousel.scrollSnapList().length - 1) {
        carousel.scrollTo(0);
      } else {
        carousel.scrollNext();
      }
    }, 4500);
    return () => window.clearInterval(interval);
  }, [carousel, snapCount]);
  return (
    <section aria-label={title} className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
          {snapCount > 1 ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {selectedSnap + 1}/{snapCount}
            </span>
          ) : null}
        </div>
        {snapCount > 1 ? (
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              className="size-8 p-0"
              aria-label={`${title}: anterior`}
              title="Anterior"
              disabled={!canPrev}
              onClick={() => carousel?.scrollPrev()}
            >
              <ChevronLeft className="size-4" />
            </Btn>
            <Btn
              variant="ghost"
              className="size-8 p-0"
              aria-label={`${title}: próximo`}
              title="Próximo"
              disabled={!canNext}
              onClick={() => carousel?.scrollNext()}
            >
              <ChevronRight className="size-4" />
            </Btn>
          </div>
        ) : null}
      </div>
      <div ref={viewport} className="overflow-hidden">
        <div className="-ml-3 flex touch-pan-y">{children}</div>
      </div>
      {snapCount > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" aria-label={`${title}: páginas`}>
          {Array.from({ length: snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Mostrar slide ${index + 1} de ${title}`}
              aria-current={index === selectedSnap ? "true" : undefined}
              onClick={() => carousel?.scrollTo(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === selectedSnap ? "w-6 bg-menu-brand" : "w-1.5 bg-stone-300"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const FOOD_IMAGES = ["/demo-assets/sushi-sakura.jpg", "/demo-assets/ramen.jpg"];

function FoodSlideImage({
  imageUrl,
  fallback,
  alt,
}: {
  imageUrl: string | null;
  fallback: string;
  alt: string;
}) {
  const [src, setSrc] = useState(imageUrl ? apiAssetUrl(imageUrl) : fallback);
  useEffect(() => setSrc(imageUrl ? apiAssetUrl(imageUrl) : fallback), [imageUrl, fallback]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      sizes="(min-width: 1024px) 900px, 100vw"
      className="absolute inset-0 size-full object-cover"
      onError={() => setSrc(src === fallback ? "" : fallback)}
    />
  );
}

export function MenuHighlights({ slug, promotions }: { slug: string; promotions: ApiPromotion[] }) {
  const { coupons, error: couponLoadError } = usePublicTenantCoupons(slug);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const now = Date.now();
  const visibleCoupons = coupons.filter(
    (coupon) =>
      coupon.active &&
      now >= new Date(coupon.startsAt).getTime() &&
      now <= new Date(coupon.expiresAt).getTime() &&
      (coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses),
  );
  const visiblePromotions = promotions.filter((promotion) => promotion.isActive !== false);
  const promotionSlides = Array.from({ length: 2 }, (_, index) => visiblePromotions[index] ?? null);
  const couponSlides = Array.from({ length: 2 }, (_, index) => visibleCoupons[index] ?? null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setCopyError("");
    } catch {
      setCopyError(`Copie o código: ${code}`);
    }
  }
  return (
    <>
      <HighlightCarousel title="Promoções da semana">
        {promotionSlides.map((promotion, index) => (
          <div
            key={promotion?.id ?? `promotion-placeholder-${index}`}
            className="min-w-0 shrink-0 basis-full pl-3"
          >
            <article className="relative isolate flex aspect-[16/8] min-h-56 flex-col justify-end overflow-hidden rounded-3xl border border-black/5 bg-stone-900 p-6 shadow-md sm:min-h-72 sm:p-10">
              <FoodSlideImage
                imageUrl={promotion?.imageUrl ?? null}
                fallback={FOOD_IMAGES[index]}
                alt={promotion?.title || "Prato japonês em destaque"}
              />
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-black/80 via-black/35 to-black/5" />
              <div className="relative z-10 max-w-xl text-white">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
                  {promotion
                    ? "Destaque da semana"
                    : index === 0
                      ? "Feito na hora"
                      : "Sabores do Japão"}
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-4xl">
                  {promotion?.title || (index === 0 ? "Combinados especiais" : "Ramen da casa")}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
                  {promotion?.description ||
                    (index === 0
                      ? "Peças frescas e selecionadas para compartilhar bons momentos."
                      : "Caldo encorpado, noodles e sabores preparados com cuidado.")}
                </p>
              </div>
            </article>
          </div>
        ))}
      </HighlightCarousel>
      <HighlightCarousel title="Cupons de desconto">
        {couponSlides.map((coupon, index) => (
          <div
            key={coupon?.id ?? `coupon-placeholder-${index}`}
            className="min-w-0 shrink-0 basis-full pl-3"
          >
            <article className="relative isolate flex aspect-[16/8] min-h-56 flex-col justify-center overflow-hidden rounded-3xl border border-black/5 bg-stone-900 p-6 shadow-md sm:min-h-72 sm:p-10">
              <FoodSlideImage
                imageUrl={null}
                fallback={FOOD_IMAGES[index]}
                alt="Comida japonesa preparada na hora"
              />
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-rose-950/85 via-rose-900/55 to-black/10" />
              <div className="relative z-10 max-w-xl text-white">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <TicketPercent className="size-4" aria-hidden="true" />
                  {coupon ? "Oferta exclusiva" : "Clube de ofertas"}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-4xl">
                  {coupon
                    ? coupon.kind === "percentual"
                      ? `${coupon.value}% de desconto`
                      : coupon.kind === "valor-fixo"
                        ? `${brl(coupon.value)} de desconto`
                        : "Frete grátis"
                    : index === 0
                      ? "Cupons para deixar seu pedido ainda melhor"
                      : "Novas ofertas aparecem por aqui"}
                </h3>
                {coupon ? (
                  <>
                    <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold tracking-wider text-rose-900">
                      {coupon.code}
                      <button
                        type="button"
                        aria-label={`Copiar cupom ${coupon.code}`}
                        onClick={() => void copy(coupon.code)}
                        className="rounded-md p-1 hover:bg-rose-50"
                      >
                        <Copy className="size-4" />
                      </button>
                    </p>
                    <p className="mt-2 text-xs text-white/85">
                      Válido até {new Date(coupon.expiresAt).toLocaleDateString("pt-BR")}
                      {copied === coupon.code ? " · Código copiado!" : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-white/85">
                    {index === 0
                      ? "Digite seu cupom no carrinho para aplicar o desconto."
                      : "Acompanhe o cardápio para aproveitar as próximas campanhas."}
                  </p>
                )}
              </div>
            </article>
          </div>
        ))}
      </HighlightCarousel>
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        {copyError || couponLoadError}
      </p>
    </>
  );
}
