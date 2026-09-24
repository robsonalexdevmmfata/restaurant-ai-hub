import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { PageGate, useLoad } from "@/components/kit";
import { brl } from "@/lib/api";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super admin — RestauranteAI" },
      { name: "description", content: "Visão global de todos os restaurantes da plataforma." },
      { property: "og:title", content: "Super admin — RestauranteAI" },
      { property: "og:description", content: "Visão global de todos os restaurantes da plataforma." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { tenant } = useRequireTenant();
  const o = useLoad(() => data.adminOverview(), []);
  if (!tenant) return <PageGate />;
  const m = o.data?.metrics;
  const kpis = m ? [
    ["Restaurantes", m.restaurants], ["Usuários", m.users], ["Produtos", m.products],
    ["Conversas", m.conversations], ["Pedidos", m.orders], ["Faturamento", brl(m.revenue)],
  ] : [];

  return (
    <AppShell tenant={tenant} title="Super admin" subtitle="Métricas globais da plataforma">
      {o.error ? <p className="mb-3 text-[13px] text-red-600">{o.error}</p> : null}
      {!o.data ? <Skeleton className="h-64" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map(([k, v]) => (
              <Card key={k as string} className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{k}</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums">{v}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-stone-400">
                <tr>{["Restaurante", "Cidade", "Instância", "Usuários", "Pedidos", "Faturamento", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {o.data.restaurants.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.name}<p className="text-[11px] text-stone-400">/{r.slug}</p></td>
                    <td className="px-4 py-3">{[r.city, r.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-3">{r.whatsappInstance}</td>
                    <td className="px-4 py-3 tabular-nums">{r.userCount}</td>
                    <td className="px-4 py-3 tabular-nums">{r.orderCount}</td>
                    <td className="px-4 py-3 tabular-nums">{brl(r.revenue)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.isOpen ? "bg-brand/10 text-brand-deep" : "bg-stone-200 text-stone-600"}`}>{r.isOpen ? "Aberto" : "Fechado"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
