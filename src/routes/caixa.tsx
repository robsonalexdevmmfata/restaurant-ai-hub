import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Empty, Modal, PageGate, useLoad } from "@/components/kit";
import { brl, type ApiSession, type PaymentMethod } from "@/lib/api";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — RestauranteAI" },
      { name: "description", content: "Feche as contas das mesas abertas." },
      { property: "og:title", content: "Caixa — RestauranteAI" },
      { property: "og:description", content: "Feche as contas das mesas abertas." },
    ],
  }),
  component: CaixaPage,
});

const methods: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "Pix" }, { id: "cartao", label: "Cartão" }, { id: "dinheiro", label: "Dinheiro" }, { id: "outros", label: "Outros" },
];

function CaixaPage() {
  const { tenant } = useRequireTenant();
  const sessions = useLoad(() => data.listOpenSessions(), [], 8000);
  const [sel, setSel] = useState<ApiSession | null>(null);
  if (!tenant) return <PageGate />;

  const total = sessions.data?.reduce((a, s) => a + s.total, 0) ?? 0;

  return (
    <AppShell tenant={tenant} title="Caixa" subtitle={`Mesas abertas · ${brl(total)} em aberto`}>
      {!sessions.data ? <Skeleton className="h-48" /> : sessions.data.length === 0 ? <Card><Empty>Nenhuma mesa aberta no momento.</Empty></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.data.map((s) => (
            <Card key={s.sessionId} className="p-4">
              <div className="flex justify-between">
                <p className="font-display text-[15px] font-semibold">{s.tableLabel}</p>
                <span className="text-[12px] text-stone-500">desde {new Date(s.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="mt-2 text-[22px] font-semibold tabular-nums">{brl(s.total)}</p>
              <p className="text-[12px] text-stone-500">{s.orders.length} pedido(s)</p>
              <Btn className="mt-3 w-full" onClick={() => setSel(s)}>Fechar conta</Btn>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!sel} title={`Conta — ${sel?.tableLabel ?? ""}`} onClose={() => setSel(null)}>
        {sel ? (
          <div className="space-y-3">
            <div className="space-y-1 text-[13px]">
              {sel.orders.flatMap((o) => o.itemsJson ?? []).map((i, k) => (
                <div key={k} className="flex justify-between"><span>{i.quantity}x {i.name}</span><span className="tabular-nums">{brl(i.price * i.quantity)}</span></div>
              ))}
              <div className="flex justify-between border-t border-black/5 pt-2 text-[15px] font-semibold"><span>Total</span><span>{brl(sel.total)}</span></div>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((m) => (
                <Btn key={m.id} variant="ghost" onClick={async () => { await data.closeSession(sel.sessionId, m.id); setSel(null); sessions.reload(); }}>{m.label}</Btn>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
