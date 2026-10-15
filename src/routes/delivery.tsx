import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Empty, Field, inputCls, Modal, PageGate, useLoad } from "@/components/kit";
import { CartSummary, cartItems, ProductPicker, type Cart } from "@/components/order-builder";
import { brl } from "@/lib/api";
import { data, statusLabel } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery — RestauranteAI" },
      { name: "description", content: "Pedidos de entrega do restaurante." },
      { property: "og:title", content: "Delivery — RestauranteAI" },
      { property: "og:description", content: "Pedidos de entrega do restaurante." },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const { tenant } = useRequireTenant();
  const orders = useLoad(async () => (await data.listOrders()).filter((o) => o.source === "delivery" || o.source === "ia"), [], 8000);
  const products = useLoad(async () => (await data.listProducts()).filter((p) => p.status === "DISPONIVEL"), []);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart>({});
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  if (!tenant) return <PageGate />;

  async function save() {
    const items = cartItems(cart);
    if (!items.length || !f.name) return;
    await data.createOrder({ source: "delivery", customerName: f.name, customerPhone: f.phone, notes: f.address ? `Entrega: ${f.address}` : "", items });
    setOpen(false); setCart({}); setF({ name: "", phone: "", address: "" });
    orders.reload();
  }

  return (
    <AppShell tenant={tenant} title="Delivery" subtitle="Pedidos para entrega (painel e WhatsApp)" action={<Btn onClick={() => setOpen(true)}>Novo pedido</Btn>}>
      {!orders.data ? <Skeleton className="h-48" /> : orders.data.length === 0 ? <Card><Empty>Nenhum pedido de entrega ainda.</Empty></Card> : (
        <Card className="divide-y divide-black/5">
          {orders.data.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">#{o.id} · {o.customerName ?? "Cliente"} {o.customerPhone ? <span className="font-normal text-stone-500">· {o.customerPhone}</span> : null}</p>
                <p className="truncate text-[12px] text-stone-500">{o.orderDetails}</p>
                {o.notes ? <p className="truncate text-[12px] text-stone-500">{o.notes}</p> : null}
              </div>
              <span className="text-[13px] font-semibold tabular-nums">{brl(o.total)}</span>
              <select className="rounded-md bg-white px-2 py-1.5 text-[12px] ring-1 ring-black/10" value={o.status} onChange={async (e) => { await data.updateOrderStatus(o.id, e.target.value as typeof o.status); orders.reload(); }}>
                {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ))}
        </Card>
      )}
      <Modal open={open} title="Novo pedido de entrega" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Cliente"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Endereço"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          {products.data ? <ProductPicker products={products.data} cart={cart} onChange={setCart} /> : null}
          <CartSummary cart={cart} />
          <Btn className="w-full" onClick={save}>Criar pedido</Btn>
        </div>
      </Modal>
    </AppShell>
  );
}
