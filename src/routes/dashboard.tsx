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
import { useEffect, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createRestaurantStaffAccount, DEMO_ACCOUNTS, getRestaurantStaff, type AppRole } from "@/lib/auth";
import { brl, chats, hourly, kpis } from "@/lib/mock";
import { useTenantOperations } from "@/lib/operations";
import { printThermalReceipt } from "@/lib/thermal-print";
import { useTenantBranding } from "@/lib/tenant-branding";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão geral · RestauranteAI" },
      { name: "description", content: "Atendimentos, pedidos fechados pela IA e faturamento estimado do dia." },
      { property: "og:title", content: "Visão geral · RestauranteAI" },
      { property: "og:description", content: "Métricas do dia do seu atendimento por IA no WhatsApp." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { tenant, loading } = useRequireTenant("owner");
  const { operations } = useTenantOperations(tenant?.restaurantSlug ?? "pizzaria-vulcao");
  const { branding } = useTenantBranding(tenant?.restaurantSlug ?? "pizzaria-vulcao");
  const [ready, setReady] = useState(false);
  const [teamMembers, setTeamMembers] = useState(() => getRestaurantStaff(tenant?.restaurantSlug || "pizzaria-vulcao"));
  const [selectedAuditMember, setSelectedAuditMember] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cozinha" as Exclude<AppRole, "super_admin" | "owner">,
  });

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (tenant) {
      setTeamMembers(getRestaurantStaff(tenant.restaurantSlug));
    }
  }, [tenant]);

  if (loading || !tenant) return <BootScreen />;

  const fallbackMembers = [DEMO_ACCOUNTS.cozinha, DEMO_ACCOUNTS.caixa, DEMO_ACCOUNTS.motoboy].map((member) => ({
    id: `${tenant.restaurantSlug}-${member.role}`,
    name: member.name,
    email: member.email,
    role: member.role,
  }));
  const staffCards = teamMembers.length ? teamMembers : fallbackMembers;
  const selectedAuditEntries = selectedAuditMember
    ? operations.staffAudit.filter((entry) => entry.actorEmail === selectedAuditMember.email.toLowerCase())
    : [];

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const revenueSeries = [
    { label: "11h", value: 320 },
    { label: "13h", value: 540 },
    { label: "15h", value: 680 },
    { label: "17h", value: 940 },
    { label: "19h", value: 1260 },
    { label: "21h", value: 1100 },
    { label: "23h", value: 820 },
  ];
  const favoriteProducts = [
    { name: "Margherita", value: 42 },
    { name: "Calabresa", value: 33 },
    { name: "Veggie", value: 25 },
    { name: "Borda Catupiry", value: 19 },
  ];
  const aiVolume = [
    { label: "11h", chats: 18 },
    { label: "13h", chats: 24 },
    { label: "15h", chats: 27 },
    { label: "17h", chats: 42 },
    { label: "19h", chats: 59 },
    { label: "21h", chats: 48 },
  ];
  const paidOrders = operations.orders.filter((order) => order.paymentStatus === "Pago");
  const detailedSales = paidOrders.reduce(
    (sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + item.qty * item.price, 0) - (order.discountAmount ?? 0),
    0,
  );
  const unitemizedSales = Math.max(0, operations.revenue - detailedSales);

  function exportDailyCsv() {
    const rows = [
      ["Data", "Restaurante", "Pedido", "Cliente", "Pagamento", "Bruto", "Desconto", "Total"],
      ...paidOrders.map((order) => {
        const gross = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
        return [
          new Date().toLocaleDateString("pt-BR"),
          tenant.restaurant,
          order.id,
          order.customer,
          order.paymentMethod ?? "Não informado",
          gross.toFixed(2),
          (order.discountAmount ?? 0).toFixed(2),
          (gross - (order.discountAmount ?? 0)).toFixed(2),
        ];
      }),
      [new Date().toLocaleDateString("pt-BR"), tenant.restaurant, "Resumo do dia", "", "", "", "", operations.revenue.toFixed(2)],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fechamento-${tenant.restaurantSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ title: "CSV exportado", description: "O resumo diário foi baixado.", variant: "success" });
  }

  function exportDailyPdf() {
    const printed = printThermalReceipt({
      kind: "summary",
      restaurant: tenant.restaurant,
      cnpj: branding.cnpj,
      documentId: new Date().toLocaleDateString("pt-BR"),
      operator: tenant.name,
      items: paidOrders.map((order) => ({
        name: `${order.id} · ${order.customer} · ${order.paymentMethod ?? "Pagamento não informado"}`,
        quantity: 1,
        unitPrice: Math.max(0, order.items.reduce((sum, item) => sum + item.qty * item.price, 0) - (order.discountAmount ?? 0)),
      })),
      fields: [
        { label: "Vendas pagas", value: String(operations.paidOrderCount) },
        { label: "Pedidos em aberto", value: String(operations.orders.filter((order) => order.paymentStatus === "Pendente").length) },
        { label: "Vendas anteriores detalhadas", value: brl(unitemizedSales) },
      ],
      total: operations.revenue,
      footer: "Fechamento diário · documento para salvar como PDF",
    }, "80mm");
    if (!printed) showToast({ title: "Pop-up bloqueado", description: "Permita pop-ups para imprimir ou salvar o fechamento em PDF.", variant: "warning" });
  }

  function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    const created = createRestaurantStaffAccount({
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      restaurant: tenant.restaurant,
      restaurantSlug: tenant.restaurantSlug,
      owner: tenant.name,
    });

    if (!created) return;

    setTeamMembers((prev) => [...prev, created]);
    setForm({ name: "", email: "", password: "", role: "cozinha" });
  }

  return (
    <AppShell
      tenant={tenant}
      title="Visão geral"
      subtitle={`${tenant.restaurant} · hoje, ${today}`}
      action={
        <Link
          to="/conversas"
          className="rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white ring-1 ring-brand/30 transition-colors hover:bg-brand-deep"
        >
          Ver conversas
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="p-4">
              <p className="text-[12px] font-medium text-stone-500">{kpi.label}</p>
              {ready ? (
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  {kpi.label === "Faturamento estimado" ? brl(operations.revenue) : kpi.value}
                </p>
              ) : (
                <Skeleton className="mt-2 h-7 w-24" />
              )}
              <p className={`mt-1 text-[11px] font-medium ${kpi.accent ? "text-brand" : "text-stone-400"}`}>
                {kpi.note}
              </p>
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] font-semibold">Volume de atendimento por horário</p>
            <span className="text-[11px] text-stone-400">11h — 23h</span>
          </div>
          <div className="flex h-32 items-end gap-1.5">
            {hourly.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all duration-700 ${
                    h.peak ? (h.value > 80 ? "bg-brand" : "bg-brand/40") : h.value > 50 ? "bg-stone-300" : "bg-stone-200"
                  }`}
                  style={{ height: ready ? `${h.value}%` : "4%" }}
                />
                <span className={`text-[9px] ${h.value > 80 ? "font-medium text-stone-500" : "text-stone-400"}`}>
                  {h.hour}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <Tabs defaultValue="relatorios">
            <div className="flex flex-col gap-3 border-b border-black/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-semibold">Relatórios e fechamento de caixa diário</p>
                <p className="mt-1 text-[11px] text-stone-500">Resumo das vendas de {today}</p>
              </div>
              <TabsList className="w-fit bg-stone-100">
                <TabsTrigger value="relatorios" className="text-[12px]">Relatórios</TabsTrigger>
                <TabsTrigger value="fechamento" className="text-[12px]">Fechamento diário</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="relatorios" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-[11px] text-stone-500">Vendas pagas</p>
                      <p className="mt-1 text-lg font-semibold">{operations.paidOrderCount}</p>
                    </div>
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-[11px] text-stone-500">Faturamento</p>
                      <p className="mt-1 text-lg font-semibold">{brl(operations.revenue)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={exportDailyCsv} className="rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                      Exportar CSV
                    </button>
                    <button type="button" onClick={exportDailyPdf} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50">
                      Imprimir / PDF
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold">Horários de pico de movimento</p>
                  <div className="mt-2 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Movimento" fill="#128c45" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fechamento" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-[11px] text-stone-500">Faturamento acumulado</p>
                  <p className="mt-1 text-lg font-semibold">{brl(operations.revenue)}</p>
                </div>
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-[11px] text-stone-500">Pedidos pagos</p>
                  <p className="mt-1 text-lg font-semibold">{operations.paidOrderCount}</p>
                </div>
                <div className="rounded-md bg-stone-50 p-3">
                  <p className="text-[11px] text-stone-500">Pedidos em aberto</p>
                  <p className="mt-1 text-lg font-semibold">{operations.orders.filter((order) => order.paymentStatus === "Pendente").length}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={exportDailyCsv} className="rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                  Baixar resumo CSV
                </button>
                <button type="button" onClick={exportDailyPdf} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50">
                  Gerar PDF do fechamento
                </button>
              </div>
              {unitemizedSales > 0 && <p className="mt-3 text-[11px] text-stone-500">O faturamento acumulado inclui vendas anteriores detalhadas no sistema.</p>}
            </TabsContent>
          </Tabs>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="p-4">
            <p className="text-[13px] font-semibold">Faturamento por hora</p>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#128c45" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#128c45" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#128c45" fill="url(#revenueFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[13px] font-semibold">Pratos mais vendidos</p>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={favoriteProducts} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#128c45" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <p className="text-[13px] font-semibold">Conversas atendidas pela IA</p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="chats" stroke="#0f172a" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <p className="text-[13px] font-semibold">Conversas recentes</p>
            <Link to="/conversas" className="text-[12px] font-medium text-brand hover:underline">
              Abrir inbox
            </Link>
          </div>
          <div className="divide-y divide-black/5">
            {chats.map((chat) => {
              const total = chat.cart.reduce((s, i) => s + i.price * i.qty, 0);
              return (
                <div key={chat.id} className="flex items-center gap-2.5 p-3">
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="size-9 shrink-0 rounded-full object-cover ring-1 ring-black/5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{chat.name}</p>
                    <p className="truncate text-[12px] text-stone-500">
                      {chat.messages[chat.messages.length - 1]?.text}
                    </p>
                  </div>
                  <span className="hidden text-[12px] font-medium sm:block">{total ? brl(total) : "—"}</span>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      chat.mode === "ia" ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {chat.mode === "ia" ? "IA" : "Humano"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card id="equipe" className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Gestão de equipe</p>
            <span className="text-[11px] text-stone-400">{staffCards.length} acessos exibidos</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {staffCards.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedAuditMember(member)}
                  className="rounded-md border border-black/5 bg-stone-50 p-3 text-left transition hover:border-brand/30 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <span className="block font-medium">{member.name}</span>
                  <span className="mt-1 block text-[12px] text-stone-500">{member.role === "cozinha" ? "Cozinha" : member.role === "caixa" ? "Caixa / PDV" : "Motoboy"}</span>
                  <span className="mt-2 block truncate text-[11px] text-brand">{member.email}</span>
                  <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">Ver atividade</span>
                </button>
              ))}
            </div>

            <form onSubmit={addMember} className="rounded-xl border border-black/5 bg-stone-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">Adicionar login</p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">Nome</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">E-mail</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">Senha</span>
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">Função</span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Exclude<AppRole, "super_admin" | "owner"> }))}
                    className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="cozinha">Cozinheira</option>
                    <option value="caixa">Caixa / PDV</option>
                    <option value="motoboy">Motoboy</option>
                  </select>
                </label>
                <button type="submit" className="w-full rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                  Criar login
                </button>
              </div>
            </form>
          </div>
        </Card>
      </div>
      <Dialog open={Boolean(selectedAuditMember)} onOpenChange={(open) => { if (!open) setSelectedAuditMember(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Atividade de {selectedAuditMember?.name ?? "colaborador"}</DialogTitle>
            <DialogDescription>
              {selectedAuditMember?.role === "motoboy" ? "Rotas e entregas registradas" : selectedAuditMember?.role === "caixa" ? "Comandas, recebimentos e turnos de caixa" : "Pedidos e turnos registrados"}
              {selectedAuditMember ? ` · ${selectedAuditMember.email}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Entregas", selectedAuditEntries.filter((entry) => entry.kind === "delivery").length],
              ["Mesas", selectedAuditEntries.filter((entry) => entry.kind === "table").length],
              ["Turnos", selectedAuditEntries.filter((entry) => entry.kind === "shift").length],
            ].map(([label, count]) => (
              <div key={label} className="rounded-md bg-stone-50 p-3">
                <p className="text-[10px] text-stone-500">{label}</p>
                <p className="mt-1 text-lg font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <div className="divide-y divide-black/5 rounded-md border border-black/5">
            {selectedAuditEntries.length ? selectedAuditEntries.map((entry) => (
              <article key={entry.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[12px] font-semibold">{entry.title}</p>
                  <span className="rounded bg-stone-100 px-2 py-1 text-[9px] font-semibold uppercase text-stone-500">{entry.kind === "delivery" ? "Entrega" : entry.kind === "table" ? "Mesa" : entry.kind === "shift" ? "Turno" : "Pedido"}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-stone-600">{entry.details}</p>
                <p className="mt-2 text-[10px] text-stone-400">{new Date(entry.createdAt).toLocaleString("pt-BR")}{entry.relatedId ? ` · ${entry.relatedId}` : ""}</p>
              </article>
            )) : (
              <p className="p-5 text-center text-[12px] text-stone-500">Nenhuma atividade registrada para este colaborador ainda.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function BootScreen() {
  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
