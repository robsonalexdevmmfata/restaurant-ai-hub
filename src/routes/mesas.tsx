import { createFileRoute } from "@tanstack/react-router";
import { Copy, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
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

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&format=png&ecc=H&data=${encodeURIComponent(value)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function QrPreview({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="grid size-40 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
      {failed ? (
        <div className="text-center text-brand">
          <QrCode className="mx-auto size-10" />
          <p className="mt-2 text-[10px] text-stone-500">Prévia indisponível</p>
        </div>
      ) : (
        <img
          src={qrImageUrl(url)}
          alt={`QR Code escaneável para ${label}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/mesas")({
  head: () => ({ meta: [{ title: "Mesas e QR Codes — RestauranteAI" }, { name: "description", content: "RestauranteAI — mesas e qr codes." }, { property: "og:title", content: "Mesas e QR Codes — RestauranteAI" }, { property: "og:description", content: "RestauranteAI — mesas e qr codes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),

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
    const tableLabel = `Mesa ${tableId}`;
    const appUrl = import.meta.env['VITE_PUBLIC_APP_URL']?.replace(/\/$/, "") ||
      (typeof window === "undefined" ? "" : window.location.origin);
    return `${appUrl}/r/${encodeURIComponent(tenant?.restaurantSlug ?? slug)}?mesa=${encodeURIComponent(tableLabel)}`;
  }

  function printQr(tableId: number) {
    if (!tenant) return;
    const destination = tableMenuUrl(tableId);
    const qr = qrImageUrl(destination);
    const popup = window.open("", "_blank", "width=640,height=820");
    if (!popup) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para abrir o QR Code da mesa.", variant: "warning" });
    if (!popup) return;

    popup.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${escapeHtml(tenant.restaurant)} · Mesa ${tableId}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; color: #17211c; font: 16px Arial, sans-serif; text-align: center; }
            main { max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e7e9e6; border-radius: 24px; }
            img { display: block; width: min(100%, 360px); height: auto; margin: 24px auto; }
            h1 { margin: 0; font-size: 28px; }
            p { color: #66716b; line-height: 1.5; }
            .url { overflow-wrap: anywhere; font-size: 12px; }
            button { margin-top: 12px; padding: 12px 20px; border: 0; border-radius: 10px; background: #138b4c; color: white; font-size: 15px; font-weight: 700; cursor: pointer; }
            @media print { body { padding: 0; } main { border: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <main>
            <p>${escapeHtml(tenant.restaurant)}</p>
            <h1>Mesa ${String(tableId).padStart(2, "0")}</h1>
            <img src="${escapeHtml(qr)}" alt="QR Code para abrir o cardápio da mesa ${tableId}">
            <p>Escaneie com a câmera do celular para abrir o cardápio e fazer seu pedido.</p>
            <p class="url">${escapeHtml(destination)}</p>
            <button onclick="window.print()">Imprimir QR Code</button>
          </main>
        </body>
      </html>`);
    popup.document.close();
  }

  async function copyTableMenuUrl(tableId: number) {
    try {
      await navigator.clipboard.writeText(tableMenuUrl(tableId));
      showToast({ title: "Link copiado", description: `O link da Mesa ${tableId} está pronto para compartilhar.`, variant: "success" });
    } catch {
      showToast({ title: "Não foi possível copiar", description: "Verifique a permissão de área de transferência do navegador.", variant: "warning" });
    }
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
                  <QrPreview url={tableMenuUrl(table.id)} label={`Mesa ${table.id}`} />
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
                    <Printer className="size-4" />
                    Imprimir QR
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyTableMenuUrl(table.id)}
                    aria-label={`Copiar link da Mesa ${table.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <Copy className="size-4" />
                    Copiar link
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
