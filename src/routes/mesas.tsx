import { createFileRoute } from "@tanstack/react-router";
import { Printer, QrCode } from "lucide-react";
import { useEffect } from "react";
import { AppShell, Card } from "@/components/app-shell";
import { createStaffActivity, updateTenantOperations, useTenantOperations, type RestaurantTableStatus } from "@/lib/operations";
import { hasPublicApi, publicApiUrl } from "@/lib/public-api";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

const statusClasses: Record<RestaurantTableStatus, string> = {
  Livre: "bg-emerald-100 text-emerald-700",
  Ocupada: "bg-amber-100 text-amber-700",
  "Comanda Aberta": "bg-sky-100 text-sky-700",
  "Aguardando Pagamento": "bg-rose-100 text-rose-700",
};

export const Route = createFileRoute("/mesas")({
  component: TablesView,
});

function TablesView() {
  const { tenant, loading } = useRequireTenant("owner");
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { operations, update } = useTenantOperations(slug);
  const tables = operations.tables;

  useEffect(() => {
    if (!hasPublicApi()) return;
    let active = true;
    const syncTables = async () => {
      try {
        const response = await fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables`));
        if (!response.ok) return;
        const result = await response.json() as { tables: { tableNumber: number; status: string; sessionId: string | null; openedAt: string | null }[] };
        if (!active) return;
        updateTenantOperations(slug, (current) => ({
          ...current,
          tables: current.tables.map((table) => {
            const remote = result.tables.find((item) => item.tableNumber === table.id);
            if (!remote) return table;
            const status = remote.status === "Livre" ? "Livre" : table.status === "Livre" ? "Ocupada" : table.status;
            return { ...table, status, openedAt: remote.openedAt ?? table.openedAt, serverSessionId: remote.sessionId };
          }),
        }));
      } catch {
        // Local demo mode remains available when the API cannot be reached.
      }
    };
    void syncTables();
    const interval = window.setInterval(() => void syncTables(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [slug]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  function cycleStatus(id: number) {
    if (!tenant) return;
    const table = tables.find((item) => item.id === id);
    if (!table) return;
    const statusOrder: RestaurantTableStatus[] = ["Livre", "Ocupada", "Comanda Aberta", "Aguardando Pagamento"];
    const nextStatus = statusOrder[(statusOrder.indexOf(table.status) + 1) % statusOrder.length]!;
    const hasOpenBill = operations.orders.some((order) =>
      order.orderType === "Salão" && order.paymentStatus === "Pendente" && Number(order.table.match(/\d+/)?.[0]) === id,
    );
    if (nextStatus === "Livre" && hasOpenBill) {
      showToast({ title: "Comanda ainda aberta", description: "Feche a conta pelo Caixa antes de liberar esta mesa.", variant: "warning" });
      return;
    }
    const timestamp = new Date().toISOString();
    const activity = createStaffActivity(tenant, {
      kind: "table",
      title: nextStatus === "Livre" ? `Fechou Mesa ${id}` : table.status === "Livre" ? `Abriu Mesa ${id}` : `Atualizou Mesa ${id}`,
      details: `Status alterado de ${table.status} para ${nextStatus}.`,
      relatedId: `mesa-${id}`,
    });
    if (hasPublicApi() && table.serverSessionId && nextStatus === "Livre") {
      void fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables/${id}/close`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: table.serverSessionId }),
      });
    }
    if (hasPublicApi() && table.status === "Livre" && nextStatus !== "Livre") {
      void fetch(publicApiUrl(`/api/public/tenants/${encodeURIComponent(slug)}/tables/${id}/open`), { method: "POST" });
    }
    update((current) => ({
      ...current,
      tables: current.tables.map((item) => item.id === id
        ? { ...item, status: nextStatus, openedAt: nextStatus === "Livre" ? null : item.openedAt ?? timestamp, openedBy: nextStatus === "Livre" ? null : item.openedBy ?? tenant.name, serverSessionId: nextStatus === "Livre" ? null : item.serverSessionId }
        : item),
      staffAudit: [activity, ...current.staffAudit],
    }));
  }

  function tableMenuUrl(tableId: number) {
    return `${window.location.origin}/m/${tenant?.restaurantSlug ?? slug}/mesa/${tableId}`;
  }

  function printQr(tableId: number) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(tableMenuUrl(tableId))}&size=420x420`;
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para abrir o QR Code da mesa.", variant: "warning" });
  }

  return (
    <AppShell tenant={tenant} title="Mesas do salão" subtitle={`${tenant.restaurant} · gestão de ocupação em tempo real`}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Mesas livres", tables.filter((table) => table.status === "Livre").length],
            ["Ocupadas", tables.filter((table) => table.status === "Ocupada").length],
            ["Comandas abertas", tables.filter((table) => table.status === "Comanda Aberta").length],
            ["Pagamentos pendentes", tables.filter((table) => table.status === "Aguardando Pagamento").length],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-[12px] font-medium text-stone-500">{label}</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            return (
              <Card key={table.id} className="overflow-hidden p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-xl font-semibold">Mesa {String(table.id).padStart(2, "0")}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClasses[table.status]}`}>
                      {table.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => cycleStatus(table.id)}
                    className="rounded-md border border-black/5 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                  >
                    Trocar status
                  </button>
                </div>

                <div className="mt-4 flex flex-col items-center rounded-lg bg-stone-50 px-4 py-5 ring-1 ring-black/5">
                  <div
                    role="img"
                    aria-label={`Pré-visualização do QR Code da mesa ${table.id}`}
                    className="relative grid size-36 place-items-center rounded-xl border border-stone-200 bg-white shadow-sm"
                  >
                    <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-md border-[3px] border-ink bg-white">
                      <span className="size-2.5 rounded-sm bg-ink" />
                    </span>
                    <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-md border-[3px] border-ink bg-white">
                      <span className="size-2.5 rounded-sm bg-ink" />
                    </span>
                    <span className="absolute bottom-3 left-3 grid size-7 place-items-center rounded-md border-[3px] border-ink bg-white">
                      <span className="size-2.5 rounded-sm bg-ink" />
                    </span>
                    <span className="absolute bottom-5 right-5 size-2 rounded-sm bg-brand/30" />
                    <span className="absolute right-9 top-12 size-1.5 rounded-sm bg-stone-300" />
                    <span className="absolute bottom-10 right-10 size-1.5 rounded-sm bg-stone-300" />
                    <span className="relative grid size-12 place-items-center rounded-lg bg-emerald-50 text-brand ring-1 ring-brand/15">
                      <QrCode className="size-7" />
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">
                    QR Code · Mesa {String(table.id).padStart(2, "0")}
                  </p>
                  <a href={tableMenuUrl(table.id)} target="_blank" rel="noreferrer" className="mt-1 max-w-full break-all text-[10px] text-brand hover:underline">
                    {tableMenuUrl(table.id)}
                  </a>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => printQr(table.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep"
                  >
                    <QrCode className="size-4" />
                    QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <Printer className="size-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
