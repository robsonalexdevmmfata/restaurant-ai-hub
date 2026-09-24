import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Field, inputCls, PageGate, useLoad } from "@/components/kit";
import { CartSummary, cartItems, ProductPicker, type Cart } from "@/components/order-builder";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — RestauranteAI" },
      { name: "description", content: "Lance pedidos de mesa e balcão rapidamente." },
      { property: "og:title", content: "PDV — RestauranteAI" },
      { property: "og:description", content: "Lance pedidos de mesa e balcão rapidamente." },
    ],
  }),
  component: PdvPage,
});

function PdvPage() {
  const { tenant } = useRequireTenant();
  const products = useLoad(async () => (await data.listProducts()).filter((p) => p.status === "DISPONIVEL"), []);
  const tables = useLoad(() => data.listTables(), []);
  const [cart, setCart] = useState<Cart>({});
  const [table, setTable] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  if (!tenant) return <PageGate />;

  async function send() {
    const items = cartItems(cart);
    if (!items.length) return;
    const t = tables.data?.find((x) => x.label === table);
    try {
      await data.createOrder({ source: t ? "pdv" : "balcao", tableId: t?.id ?? null, tableLabel: t?.label, customerName: name || undefined, notes: notes || undefined, items });
      setCart({}); setNotes(""); setName("");
      setMsg("Pedido enviado para a cozinha!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar");
    }
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <AppShell tenant={tenant} title="PDV" subtitle="Lançamento de pedidos no salão e balcão">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>{products.data ? <ProductPicker products={products.data} cart={cart} onChange={setCart} /> : <Skeleton className="h-64" />}</div>
        <Card className="h-fit space-y-3 p-4 lg:sticky lg:top-20">
          <p className="font-display text-[15px] font-semibold">Pedido</p>
          <Field label="Mesa">
            <select className={inputCls} value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">Balcão (sem mesa)</option>
              {tables.data?.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Cliente (opcional)"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Observações"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sem cebola..." /></Field>
          <CartSummary cart={cart} />
          <Btn className="w-full" disabled={!cartItems(cart).length} onClick={send}>Enviar para cozinha</Btn>
          {msg ? <p className="text-center text-[12px] text-brand-deep">{msg}</p> : null}
        </Card>
      </div>
    </AppShell>
  );
}
