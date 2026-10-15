import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, Card } from "@/components/app-shell";
import { canAccessRole } from "@/lib/auth";
import { useSubscriptions, type SubscriptionPlan } from "@/lib/billing";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração do SaaS — RestauranteAI" }, { name: "description", content: "RestauranteAI — administração do saas." }, { property: "og:title", content: "Administração do SaaS — RestauranteAI" }, { property: "og:description", content: "RestauranteAI — administração do saas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),

  component: AdminView,
});

const restaurantMetrics = [
  { slug: "pizzaria-vulcao", name: "Pizzaria Vulcão", location: "São Paulo", revenue: "R$ 18.2k", ai: "94%" },
  { slug: "burger-house", name: "Burger House", location: "Rio de Janeiro", revenue: "R$ 15.6k", ai: "89%" },
  { slug: "cafe-aurora", name: "Café Aurora", location: "Belo Horizonte", revenue: "R$ 9.7k", ai: "91%" },
];

function AdminView() {
  const { tenant, loading } = useRequireTenant("super_admin");
  const { subscriptions, update } = useSubscriptions();

  if (loading || !tenant) {
    return <div className="min-h-screen bg-stone-100" />;
  }

  if (!canAccessRole(tenant, "super_admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-stone-600">Este painel é exclusivo para Super Admin.</p>
          <Link to="/login" className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">
            Voltar para login
          </Link>
        </div>
      </div>
    );
  }

  const revenueSeries = [
    { label: "Seg", value: 2800 },
    { label: "Ter", value: 3400 },
    { label: "Qua", value: 3900 },
    { label: "Qui", value: 5200 },
    { label: "Sex", value: 6100 },
    { label: "Sáb", value: 7600 },
  ];
  const aiVolume = [
    { label: "Seg", chats: 180 },
    { label: "Ter", chats: 240 },
    { label: "Qua", chats: 210 },
    { label: "Qui", chats: 330 },
    { label: "Sex", chats: 440 },
    { label: "Sáb", chats: 520 },
  ];
  const topProducts = [
    { name: "Pizza Margherita", value: 48 },
    { name: "Calabresa", value: 36 },
    { name: "Veggie", value: 29 },
    { name: "Borda Catupiry", value: 24 },
  ];

  return (
    <AppShell tenant={tenant} title="Visão global da plataforma" subtitle="Métricas e operação de todos os restaurantes cadastrados">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Restaurantes ativos", "128"],
            ["Pedidos automáticos", "14.2k"],
            ["Taxa de resolução IA", "92%"],
            ["Receita total", "R$ 468k"],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-[12px] font-medium text-stone-500">{label}</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="p-4">
            <p className="text-[13px] font-semibold">Receita por dia</p>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="globalRevenue" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#128c45" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#128c45" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#128c45" fill="url(#globalRevenue)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[13px] font-semibold">Produtos mais vendidos</p>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <p className="text-[13px] font-semibold">Volume diário de conversas atendidas</p>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="chats" stroke="#128c45" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold">Planos e assinaturas dos tenants</p>
              <p className="mt-1 text-[11px] text-stone-500">Gerencie o plano e o acesso de cada restaurante.</p>
            </div>
          </div>
          <div className="divide-y divide-black/5">
            {restaurantMetrics.map((restaurant) => {
              const subscription = subscriptions.find((item) => item.restaurantSlug === restaurant.slug);
              const plan = subscription?.plan ?? "Essencial";
              const status = subscription?.status ?? "Ativa";
              return (
              <div key={restaurant.slug} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                <div>
                  <p className="font-medium">{restaurant.name}</p>
                  <p className="text-[12px] text-stone-500">{restaurant.location} · {restaurant.ai} resolução IA · {restaurant.revenue}/mês</p>
                </div>
                <label className="text-[11px] font-medium text-stone-500">
                  Plano
                  <select
                    value={plan}
                    onChange={(event) => {
                      update(restaurant.slug, (current) => ({ ...current, plan: event.target.value as SubscriptionPlan }));
                      showToast({ title: "Plano atualizado", description: `${restaurant.name} · ${event.target.value}`, variant: "success" });
                    }}
                    className="mt-1 block min-w-36 rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink"
                  >
                    <option>Essencial</option>
                    <option>Profissional</option>
                    <option>Enterprise</option>
                  </select>
                </label>
                <div className="text-[11px] text-stone-500">Vencimento<br /><span className="font-medium text-stone-700">{subscription?.dueDate ?? "Não informado"}</span></div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${status === "Ativa" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {status}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextStatus = status === "Ativa" ? "Suspensa" : "Ativa";
                      update(restaurant.slug, (current) => ({ ...current, status: nextStatus }));
                      showToast({
                        title: nextStatus === "Suspensa" ? "Acesso suspenso" : "Acesso reativado",
                        description: `${restaurant.name}: ${nextStatus === "Suspensa" ? "usuários serão desconectados" : "acesso liberado novamente"}.`,
                        variant: nextStatus === "Suspensa" ? "warning" : "success",
                      });
                    }}
                    className={`rounded-md px-3 py-2 text-[11px] font-semibold ${status === "Ativa" ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand text-white hover:bg-brand-deep"}`}
                  >
                    {status === "Ativa" ? "Suspender acesso" : "Reativar acesso"}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
