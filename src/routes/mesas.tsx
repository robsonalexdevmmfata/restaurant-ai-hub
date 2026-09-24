import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Empty, Field, inputCls, Modal, PageGate, useLoad } from "@/components/kit";
import { brl, type ApiTable } from "@/lib/api";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas e QR Codes — RestauranteAI" },
      { name: "description", content: "Cadastre mesas e gere QR Codes do cardápio digital." },
      { property: "og:title", content: "Mesas e QR Codes — RestauranteAI" },
      { property: "og:description", content: "Cadastre mesas e gere QR Codes do cardápio digital." },
    ],
  }),
  component: MesasPage,
});

function MesasPage() {
  const { tenant } = useRequireTenant();
  const tables = useLoad(() => data.listTables(), [], 10000);
  const slug = useLoad(() => data.restaurantSlug(), []);
  const [edit, setEdit] = useState<Partial<ApiTable> | null>(null);
  const [qr, setQr] = useState<ApiTable | null>(null);
  if (!tenant) return <PageGate />;

  const link = (t: ApiTable) =>
    `${window.location.origin}/r/${slug.data ?? "meu"}?mesa=${encodeURIComponent(t.label)}`;

  async function save() {
    if (!edit?.label) return;
    if (edit.id) await data.updateTable(edit.id, { label: edit.label, seats: edit.seats });
    else await data.createTable({ label: edit.label, seats: edit.seats });
    setEdit(null);
    tables.reload();
  }

  return (
    <AppShell
      tenant={tenant}
      title="Mesas"
      subtitle="Cada mesa tem um QR Code que abre o cardápio digital"
      action={
        <Btn onClick={() => setEdit({ label: "", seats: 4 })}>
          <Plus className="size-4" /> Nova mesa
        </Btn>
      }
    >
      {tables.error ? <p className="mb-3 text-[13px] text-red-600">{tables.error}</p> : null}
      {!tables.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : tables.data.length === 0 ? (
        <Card><Empty>Nenhuma mesa cadastrada. Clique em "Nova mesa".</Empty></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tables.data.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[15px] font-semibold">{t.label}</p>
                  <p className="text-[12px] text-stone-500">{t.seats} lugares</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.sessionId ? "bg-amber-100 text-amber-800" : "bg-brand/10 text-brand-deep"}`}>
                  {t.sessionId ? "Ocupada" : "Livre"}
                </span>
              </div>
              {t.sessionId ? (
                <p className="mt-3 text-[13px]">
                  {t.sessionOrders} pedido(s) · <b>{brl(t.sessionTotal)}</b>
                </p>
              ) : <p className="mt-3 text-[13px] text-stone-400">Sem consumo</p>}
              <div className="mt-4 flex gap-1.5">
                <Btn variant="ghost" className="flex-1" onClick={() => setQr(t)}>
                  <QrCode className="size-4" /> QR Code
                </Btn>
                <Btn variant="ghost" aria-label="Editar" onClick={() => setEdit(t)}><Pencil className="size-4" /></Btn>
                <Btn variant="danger" aria-label="Excluir" onClick={async () => {
                  if (!confirm(`Excluir ${t.label}?`)) return;
                  await data.deleteTable(t.id);
                  tables.reload();
                }}><Trash2 className="size-4" /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? "Editar mesa" : "Nova mesa"} onClose={() => setEdit(null)}>
        <div className="space-y-3">
          <Field label="Nome da mesa">
            <input className={inputCls} value={edit?.label ?? ""} placeholder="Mesa 7" onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
          </Field>
          <Field label="Lugares">
            <input type="number" min={1} className={inputCls} value={edit?.seats ?? 4} onChange={(e) => setEdit({ ...edit, seats: Number(e.target.value) })} />
          </Field>
          <Btn className="w-full" onClick={save}>Salvar</Btn>
        </div>
      </Modal>

      <Modal open={!!qr} title={`QR Code — ${qr?.label ?? ""}`} onClose={() => setQr(null)}>
        {qr ? (
          <div className="space-y-3 text-center">
            <img
              alt={`QR Code da ${qr.label}`}
              className="mx-auto size-56 rounded-lg ring-1 ring-black/5"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(link(qr))}`}
            />
            <p className="break-all text-[12px] text-stone-500">{link(qr)}</p>
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => navigator.clipboard.writeText(link(qr))}>Copiar link</Btn>
              <Btn className="flex-1" onClick={() => window.print()}>Imprimir</Btn>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
