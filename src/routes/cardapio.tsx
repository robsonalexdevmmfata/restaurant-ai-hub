import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { brl, defaultPrompt, menu as seed, type MenuItem } from "@/lib/mock";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio e agente · RestauranteAI" },
      { name: "description", content: "Gerencie os pratos que a IA lê e ajuste as instruções de personalização do agente." },
      { property: "og:title", content: "Cardápio e agente · RestauranteAI" },
      { property: "og:description", content: "Pratos, preços, disponibilidade e instruções do agente de IA." },
    ],
  }),
  component: Cardapio,
});

function Cardapio() {
  const { tenant, loading } = useRequireTenant();
  const [items, setItems] = useState<MenuItem[]>(seed);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [saved, setSaved] = useState(false);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  const categories = [...new Set(items.map((i) => i.category))];

  function toggle(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, available: !i.available } : i)));
  }

  function savePrompt() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell
      tenant={tenant}
      title="Cardápio e agente"
      subtitle={`${tenant.restaurant} · ${items.filter((i) => i.available).length} de ${items.length} itens disponíveis`}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <p className="text-[13px] font-semibold">Itens lidos pela IA</p>
            <span className="text-[11px] text-stone-400">{categories.length} categorias</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-black/5 text-[10px] uppercase tracking-[0.12em] text-stone-400">
                  <th className="px-4 py-2.5 font-medium">Prato</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Preço</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium">{item.name}</p>
                      <p className="text-[12px] text-stone-500 text-pretty">{item.description}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-stone-500">{item.category}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{brl(item.price)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          item.available
                            ? "bg-brand/10 text-brand hover:bg-brand/20"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                      >
                        {item.available ? "Disponível" : "Indisponível"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-[13px] font-semibold">Instruções da IA</p>
          <p className="mt-1 text-[12px] text-stone-500 text-pretty">
            Descreva o tom, as regras de venda e quando transferir para um atendente humano.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={14}
            className="mt-3 w-full resize-none rounded-md bg-stone-50 px-3 py-2.5 text-[12px] leading-relaxed ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={savePrompt}
              className="rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white ring-1 ring-brand/30 transition-colors hover:bg-brand-deep"
            >
              Salvar instruções
            </button>
            {saved && <span className="text-[12px] font-medium text-brand">Salvo!</span>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
