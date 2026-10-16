import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import { useState } from "react";

import { apiAssetUrl, brl, type ApiOrderItem, type ApiProduct } from "@/lib/api";

export type Cart = Record<number, ApiOrderItem>;

export function cartItems(cart: Cart) {
  return Object.values(cart).filter((i) => i.quantity > 0);
}
export function cartTotal(cart: Cart) {
  return cartItems(cart).reduce((s, i) => s + i.price * i.quantity, 0);
}

export function changeQty(cart: Cart, p: ApiProduct, delta: number): Cart {
  const cur = cart[p.id]?.quantity ?? 0;
  const q = Math.max(0, cur + delta);
  return {
    ...cart,
    [p.id]: { productId: p.id, name: p.name, price: Number(p.price), quantity: q },
  };
}

function ProductImage({
  product,
  horizontal = false,
}: {
  product: ApiProduct;
  horizontal?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-stone-100 ${horizontal ? "h-full min-h-32" : "aspect-[4/3]"}`}
    >
      {product.imageUrl && !failed ? (
        <img
          src={apiAssetUrl(product.imageUrl)}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="grid size-full place-items-center bg-gradient-to-br from-amber-50 via-stone-50 to-orange-100 text-amber-800/50"
          aria-label="Produto sem foto"
        >
          <div className="flex flex-col items-center gap-2">
            <UtensilsCrossed className="size-8" aria-hidden="true" />
            <span className="text-[10px] font-medium">Feito na casa</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lista de produtos agrupados por categoria com botões de quantidade. */
export function ProductPicker({
  products,
  cart,
  onChange,
  brandColor = "#128c45",
}: {
  products: ApiProduct[];
  cart: Cart;
  onChange: (c: Cart) => void;
  brandColor?: string;
}) {
  const groups = products.reduce<Record<string, ApiProduct[]>>((acc, p) => {
    const k = p.category || "Outros";
    (acc[k] ??= []).push(p);
    return acc;
  }, {});
  return (
    <div className="space-y-8">
      <nav
        aria-label="Categorias do cardápio"
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-stone-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-3"
      >
        {Object.keys(groups).map((category, index) => (
          <a
            key={category}
            href={`#menu-category-${index}`}
            className="shrink-0 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:border-brand/30 hover:text-brand"
          >
            {category}
          </a>
        ))}
      </nav>
      {Object.entries(groups).map(([cat, items], index) => (
        <section key={cat} id={`menu-category-${index}`} className="scroll-mt-20">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{cat}</h2>
            <span className="text-xs text-stone-400">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div
            className={`grid gap-3 ${items.length < 3 ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}`}
          >
            {items.map((p) => {
              const q = cart[p.id]?.quantity ?? 0;
              const horizontal = items.length < 3;
              return (
                <article
                  key={p.id}
                  className={`group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg ${horizontal ? "grid grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)]" : ""}`}
                >
                  <ProductImage
                    key={p.imageUrl ?? "no-image"}
                    product={p}
                    horizontal={horizontal}
                  />
                  <div className="flex min-h-32 flex-col p-3.5">
                    <h3 className="font-display text-[15px] font-semibold leading-snug">
                      {p.name}
                    </h3>
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-stone-500">
                        {p.description}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <p className="text-base font-bold" style={{ color: brandColor }}>
                        {brl(p.price)}
                      </p>
                      <div className="flex items-center gap-2">
                        {q > 0 ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Remover ${p.name}`}
                              onClick={() => onChange(changeQty(cart, p, -1))}
                              className="grid size-9 place-items-center rounded-full border border-stone-200 text-stone-700 transition hover:bg-stone-100"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums">
                              {q}
                            </span>
                          </>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Adicionar ${p.name}`}
                          onClick={() => onChange(changeQty(cart, p, 1))}
                          style={{ backgroundColor: brandColor }}
                          className="grid size-9 place-items-center rounded-full text-white shadow-sm transition hover:brightness-90"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CartSummary({ cart, showTotal = true }: { cart: Cart; showTotal?: boolean }) {
  const items = cartItems(cart);
  if (!items.length)
    return <p className="py-6 text-center text-[13px] text-stone-500">Nenhum item adicionado.</p>;
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.productId} className="flex justify-between text-[13px]">
          <span>
            {i.quantity}x {i.name}
          </span>
          <span className="tabular-nums">{brl(i.price * i.quantity)}</span>
        </div>
      ))}
      {showTotal ? (
        <div className="flex justify-between border-t border-black/5 pt-2 text-[14px] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{brl(cartTotal(cart))}</span>
        </div>
      ) : null}
    </div>
  );
}
