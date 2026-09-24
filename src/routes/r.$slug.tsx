import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import logo from "@/assets/logo.png";
import { Btn, inputCls, useLoad } from "@/components/kit";
import { CartSummary, cartItems, cartTotal, ProductPicker, type Cart } from "@/components/order-builder";
import { brl } from "@/lib/api";
import { data } from "@/lib/data";

export const Route = createFileRoute("/r/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    mesa: typeof s.mesa === "string" ? s.mesa : undefined,
    menu: typeof s.menu === "string" ? s.menu : undefined,
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
  const { mesa, menu } = Route.useSearch();
  const res = useLoad(() => data.publicMenu(slug, menu), [slug, menu]);
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    try {
      await data.publicOrder(slug, { tableLabel: mesa, customerName: name || undefined, notes: notes || undefined, items: cartItems(cart) });
      setCart({}); setShowCart(false); setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao enviar pedido"); }
  }

  if (res.error) return <div className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center text-[14px] text-stone-600">{res.error}</div>;
  if (!res.data) return <div className="min-h-screen bg-stone-100" />;
  const r = res.data.restaurant;
  const count = cartItems(cart).reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="min-h-screen bg-stone-100 pb-28 font-sans text-ink">
      <header className="bg-ink px-4 pb-6 pt-8 text-stone-300">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-10 rounded-lg" />
            <div>
              <h1 className="font-display text-xl font-semibold text-white">{r.name}</h1>
              <p className="text-[12px]">{r.description ?? res.data.menu?.name}{r.openingHours ? ` · ${r.openingHours}` : ""}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 text-[12px]">
            {mesa ? <span className="rounded-full bg-brand px-2.5 py-1 font-semibold text-white">{mesa}</span> : null}
            <span className={`rounded-full px-2.5 py-1 ${r.isOpen ? "bg-white/10 text-white" : "bg-red-500/20 text-red-200"}`}>{r.isOpen ? "Aberto agora" : "Fechado"}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        {done ? (
          <div className="mb-4 rounded-lg bg-brand/10 p-3 text-[13px] text-brand-deep">Pedido enviado! A cozinha já recebeu. Você pode pedir mais itens quando quiser.</div>
        ) : null}
        {res.data.products.length ? <ProductPicker products={res.data.products} cart={cart} onChange={(c) => { setCart(c); setDone(false); }} /> : <p className="py-10 text-center text-[13px] text-stone-500">Cardápio vazio no momento.</p>}
      </main>
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white p-3">
          <div className="mx-auto max-w-2xl">
            {showCart ? (
              <div className="mb-3 space-y-2">
                <CartSummary cart={cart} />
                <input className={inputCls} placeholder="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={inputCls} placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
                {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
              </div>
            ) : null}
            <Btn className="w-full py-3" disabled={!r.isOpen} onClick={() => (showCart ? send() : setShowCart(true))}>
              {showCart ? `Enviar pedido · ${brl(cartTotal(cart))}` : `Ver carrinho (${count}) · ${brl(cartTotal(cart))}`}
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
