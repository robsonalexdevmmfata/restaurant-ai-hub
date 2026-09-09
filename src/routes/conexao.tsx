import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/conexao")({
  head: () => ({
    meta: [
      { title: "Conexão WhatsApp · RestauranteAI" },
      { name: "description", content: "Status da instância do WhatsApp, número conectado e leitura do QR Code." },
      { property: "og:title", content: "Conexão WhatsApp · RestauranteAI" },
      { property: "og:description", content: "Conecte o WhatsApp do restaurante ao agente de IA." },
    ],
  }),
  component: Conexao,
});

/** Deterministic pseudo-QR pattern for the simulated pairing screen. */
const cells = Array.from({ length: 25 * 25 }, (_, i) => {
  const x = i % 25;
  const y = Math.floor(i / 25);
  const corner = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
  if (corner) return (x === 0 || x === 6 || y === 0 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5)) && true;
  return (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
});

function Conexao() {
  const { tenant, loading } = useRequireTenant();
  const [status, setStatus] = useState<"conectado" | "desconectado" | "pareando">("conectado");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status !== "pareando") return;
    const t = window.setTimeout(() => setStatus("conectado"), 3000);
    return () => window.clearTimeout(t);
  }, [status]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const badge =
    status === "conectado"
      ? "bg-brand/10 text-brand"
      : status === "pareando"
        ? "bg-amber-100 text-amber-700"
        : "bg-stone-100 text-stone-500";

  return (
    <AppShell tenant={tenant} title="Conexão WhatsApp" subtitle={`${tenant.restaurant} · Evolution API`}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Instância</p>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badge}`}>
              {status === "conectado" ? "Conectado" : status === "pareando" ? "Aguardando leitura" : "Desconectado"}
            </span>
          </div>

          <div className="mt-4 grid place-items-center rounded-lg bg-stone-50 p-5 ring-1 ring-black/5">
            {booting ? (
              <Skeleton className="size-44" />
            ) : status === "conectado" ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-[18px] text-brand">
                  ✓
                </div>
                <p className="mt-3 text-[13px] font-medium">WhatsApp conectado</p>
                <p className="text-[12px] text-stone-500">A IA está respondendo os clientes agora.</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto grid size-44 grid-cols-25 gap-px bg-white p-2 ring-1 ring-black/10">
                  {cells.map((on, i) => (
                    <span key={i} className={on ? "bg-ink" : "bg-white"} />
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-stone-500 text-pretty">
                  Abra o WhatsApp do restaurante → Aparelhos conectados → Conectar aparelho.
                </p>
              </div>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-stone-500">Número</dt>
              <dd className="font-medium">+55 11 98822-0412</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Instância</dt>
              <dd className="font-medium">vulcao-prod-01</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Última sincronização</dt>
              <dd className="font-medium">há 2 minutos</dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            {status === "conectado" ? (
              <button
                type="button"
                onClick={() => setStatus("desconectado")}
                className="flex-1 rounded-md px-3 py-2 text-[13px] font-medium ring-1 ring-black/10 transition-colors hover:bg-stone-50"
              >
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatus("pareando")}
                className="flex-1 rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white ring-1 ring-brand/30 transition-colors hover:bg-brand-deep"
              >
                Gerar novo QR Code
              </button>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[13px] font-semibold">Como funciona</p>
            <ol className="mt-3 space-y-3 text-[12px] text-stone-600">
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stone-100 text-[10px] font-semibold">1</span>
                Gere o QR Code e leia com o WhatsApp do restaurante.
              </li>
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stone-100 text-[10px] font-semibold">2</span>
                O agente passa a receber as mensagens dos clientes automaticamente.
              </li>
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stone-100 text-[10px] font-semibold">3</span>
                Você acompanha tudo em Conversas e assume o chat quando quiser.
              </li>
            </ol>
          </Card>

          <Card className="p-5">
            <p className="text-[13px] font-semibold">Eventos recentes</p>
            <div className="mt-3 divide-y divide-black/5 text-[12px]">
              {[
                ["18:42", "Mensagem recebida de Carla Mendes"],
                ["18:39", "Conversa transferida para atendente humano"],
                ["18:31", "Pedido #4821 confirmado pela IA"],
                ["17:02", "Instância sincronizada com sucesso"],
              ].map(([time, text]) => (
                <div key={time} className="flex gap-3 py-2">
                  <span className="w-10 shrink-0 text-stone-400">{time}</span>
                  <span className="text-pretty">{text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
