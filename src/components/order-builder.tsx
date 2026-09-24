import { Minus, Plus } from "lucide-react";

import { brl, type ApiOrderItem, type ApiProduct } from "@/lib/api";

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
  return { ...cart, [p.id]: { productId: p.id, name: p.name, price: Number(p.price), quantity: q } };
}

/** Lista de produtos agrupados por categoria com botões de quantidade. */
export function ProductPicker({
  products,
  cart,
  onChange,
}: {
  products: ApiProduct[];
  cart: Cart;
  onChange: (c: Cart) => void;
}) {
  const groups = products.reduce<Record<string, ApiProduct[]>>((acc, p) => {
    const k = p.category || "Outros";
    (acc[k] ??= []).push(p);
    return acc;
  }, {});
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{cat}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((p) => {
              const q = cart[p.id]?.quantity ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-black/5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{p.name}</p>
                    {p.description ? <p className="line-clamp-2 text-[12px] text-stone-500">{p.description}</p> : null}
                    <p className="mt-1 text-[13px] font-semibold text-brand-deep">{brl(p.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {q > 0 ? (
                      <>
                        <button type="button" aria-label="Menos" onClick={() => onChange(changeQty(cart, p, -1))} className="grid size-7 place-items-center rounded-md ring-1 ring-black/10 hover:bg-stone-50">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-5 text-center text-[13px] font-semibold tabular-nums">{q}</span>
                      </>
                    ) : null}
                    <button type="button" aria-label="Mais" onClick={() => onChange(changeQty(cart, p, 1))} className="grid size-7 place-items-center rounded-md bg-brand text-white hover:bg-brand-deep">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CartSummary({ cart }: { cart: Cart }) {
  const items = cartItems(cart);
  if (!items.length) return <p className="py-6 text-center text-[13px] text-stone-500">Nenhum item adicionado.</p>;
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
      <div className="flex justify-between border-t border-black/5 pt-2 text-[14px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{brl(cartTotal(cart))}</span>
      </div>
    </div>
  );
}
