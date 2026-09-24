import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Empty, PageGate, useLoad } from "@/components/kit";
import type { ApiOrder } from "@/lib/api";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — RestauranteAI" },
      { name: "description", content: "Painel da cozinha com pedidos em tempo real." },
      { property: "og:title", content: "Cozinha — RestauranteAI" },
      { property: "og:description", content: "Painel da cozinha com pedidos em tempo real." },
    ],
  }),
  component: CozinhaPage,
});

const cols: { status: ApiOrder["status"]; title: string; next?: ApiOrder["status"]; nextLabel?: string }[] = [
  { status: "PENDENTE", title: "Novos", next: "PREPARANDO", nextLabel: "Iniciar preparo" },
  { status: "PREPARANDO", title: "Preparando", next: "ENTREGUE", nextLabel: "Pronto / entregue" },
  { status: "ENTREGUE", title: "Entregues" },
];

const sourceLabel: Record<string, string> = { qrcode: "QR Code", pdv: "PDV", balcao: "Balcão", delivery: "Delivery", ia: "WhatsApp IA" };

function CozinhaPage() {
  const { tenant } = useRequireTenant();
  const orders = useLoad(() => data.listOrders(), [], 5000);
  const tables = useLoad(() => data.listTables(), []);
  if (!tenant) return <PageGate />;

  const tableName = (id: number | null) => tables.data?.find((t) => t.id === id)?.label;
  const move = async (o: ApiOrder, s: ApiOrder["status"]) => {
    await data.updateOrderStatus(o.id, s);
    orders.reload();
  };

  return (
    <AppShell tenant={tenant} title="Cozinha" subtitle="Atualiza sozinho a cada 5 segundos">
      {!orders.data ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((c) => {
            const list = orders.data!.filter((o) => o.status === c.status).slice(0, c.status === "ENTREGUE" ? 10 : 100);
            return (
              <div key={c.status}>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">{c.title} · {list.length}</p>
                <div className="space-y-2">
                  {list.length === 0 ? <Card><Empty>Nada aqui.</Empty></Card> : list.map((o) => (
                    <Card key={o.id} className="p-3">
                      <div className="flex justify-between text-[12px] text-stone-500">
                        <span className="font-semibold text-ink">#{o.id} · {tableName(o.tableId) ?? o.customerName ?? sourceLabel[o.source] ?? o.source}</span>
                        <span>{new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <ul className="mt-2 space-y-0.5 text-[13px]">
                        {(o.itemsJson ?? []).length ? o.itemsJson!.map((i, k) => <li key={k}><b>{i.quantity}x</b> {i.name}</li>) : <li>{o.orderDetails}</li>}
                      </ul>
                      {o.notes ? <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-800">Obs: {o.notes}</p> : null}
                      <div className="mt-3 flex gap-1.5">
                        {c.next ? <Btn className="flex-1" onClick={() => move(o, c.next!)}>{c.nextLabel}</Btn> : null}
                        {c.status !== "ENTREGUE" ? <Btn variant="danger" onClick={() => move(o, "CANCELADO")}>Cancelar</Btn> : null}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
