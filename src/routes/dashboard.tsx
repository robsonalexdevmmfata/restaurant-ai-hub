import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { brl, chats, hourly, kpis } from "@/lib/mock";
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
  const { tenant, loading } = useRequireTenant();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(t);
  }, []);

  if (loading || !tenant) return <BootScreen />;

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

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
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{kpi.value}</p>
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
      </div>
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
