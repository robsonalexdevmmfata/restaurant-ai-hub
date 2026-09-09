import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { brl, chats as seed, type Chat, type Message } from "@/lib/mock";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas · RestauranteAI" },
      { name: "description", content: "Inbox em tempo real das conversas do WhatsApp entre clientes e o agente de IA." },
      { property: "og:title", content: "Conversas · RestauranteAI" },
      { property: "og:description", content: "Acompanhe, assuma e responda conversas do WhatsApp do seu restaurante." },
    ],
  }),
  component: Conversas,
});

function Conversas() {
  const { tenant, loading } = useRequireTenant();
  const [chats, setChats] = useState<Chat[]>(seed);
  const [selectedId, setSelectedId] = useState(seed[0]!.id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");

  const filtered = useMemo(
    () => chats.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [chats, query],
  );
  const chat = chats.find((c) => c.id === selectedId)!;

  if (loading || !tenant) {
    return (
      <div className="min-h-screen bg-stone-100 p-6">
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  function toggleMode() {
    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, mode: c.mode === "ia" ? "humano" : "ia", status: c.mode === "ia" ? "Atendimento humano" : "IA no comando" } : c,
      ),
    );
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const msg: Message = {
      id: `${Date.now()}`,
      sender: "humano",
      text,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setChats((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, mode: "humano", messages: [...c.messages, msg] } : c)),
    );
    setDraft("");
  }

  const total = chat.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = chat.cart.length ? 6 : 0;

  return (
    <AppShell tenant={tenant} title="Conversas" subtitle={`${tenant.restaurant} · ${chats.length} conversas abertas`}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_300px]">
        {/* Chat list */}
        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-black/5 px-3 py-2.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversa"
              className="w-full rounded-md bg-stone-50 px-2.5 py-1.5 text-[12px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex-1 divide-y divide-black/5 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-2.5 p-3 text-left transition-colors ${
                  c.id === selectedId ? "bg-stone-50" : "hover:bg-stone-50"
                }`}
              >
                <img
                  src={c.avatar}
                  alt={c.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="size-9 shrink-0 rounded-full object-cover ring-1 ring-black/5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{c.name}</p>
                    <span className="text-[10px] text-stone-400">{c.time}</span>
                  </div>
                  <p className="truncate text-[12px] text-stone-500">
                    “{c.messages[c.messages.length - 1]?.text}”
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    c.mode === "ia" ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.mode === "ia" ? "IA" : "Humano"}
                </span>
              </button>
            ))}
            {!filtered.length && <p className="p-4 text-[12px] text-stone-400">Nenhuma conversa encontrada.</p>}
          </div>
        </Card>

        {/* Conversation */}
        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="flex h-14 items-center justify-between border-b border-black/5 px-4">
            <div className="flex items-center gap-2.5">
              <img
                src={chat.avatar}
                alt={chat.name}
                loading="lazy"
                width={512}
                height={512}
                className="size-8 rounded-full object-cover ring-1 ring-black/5"
              />
              <div>
                <p className="text-[13px] font-medium leading-tight">{chat.name}</p>
                <p className="text-[11px] text-stone-400">{chat.status}</p>
              </div>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                chat.mode === "ia" ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-700"
              }`}
            >
              {chat.mode === "ia" ? "IA ativa" : "Assumido pelo humano"}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
            <p className="text-center text-[10px] text-stone-400">{chat.messages[0]?.time}</p>
            {chat.messages.map((m) =>
              m.sender === "cliente" ? (
                <div key={m.id} className="fade-in flex">
                  <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 ring-1 ring-black/5">
                    <p className="text-[13px] text-pretty">{m.text}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="fade-in flex justify-end">
                  <div
                    className={`max-w-[70%] rounded-2xl rounded-tr-sm px-3 py-2 ring-1 ${
                      m.sender === "ia" ? "bg-brand/10 ring-brand/15" : "bg-amber-50 ring-amber-200"
                    }`}
                  >
                    <p className="text-[13px] text-pretty">{m.text}</p>
                    <span className={`mt-1 block text-[10px] ${m.sender === "ia" ? "text-brand" : "text-amber-700"}`}>
                      {m.sender === "ia" ? "IA" : "Atendente"}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="space-y-2 border-t border-black/5 p-3">
            <button
              type="button"
              onClick={toggleMode}
              className="w-full rounded-md px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-black/10 transition-colors hover:bg-stone-50"
            >
              {chat.mode === "ia" ? "Pausar IA e assumir chat" : "Devolver conversa para a IA"}
            </button>
            <form onSubmit={send} className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Responder como atendente…"
                className="flex-1 rounded-md bg-stone-50 px-3 py-2 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30"
              />
              <button
                type="submit"
                aria-label="Enviar mensagem"
                className="grid size-8 shrink-0 place-items-center rounded-md bg-brand text-white transition-colors hover:bg-brand-deep"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </Card>

        {/* Order details */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex h-14 items-center border-b border-black/5 px-4">
            <p className="text-[13px] font-semibold">Pedido atual</p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Carrinho</p>
              {chat.cart.length ? (
                <>
                  <div className="space-y-2.5">
                    {chat.cart.map((item) => (
                      <div key={item.name} className="flex justify-between gap-2 text-[13px]">
                        <span className="text-pretty">
                          {item.qty}× {item.name}
                        </span>
                        <span className="font-medium">{brl(item.price * item.qty)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[13px] text-stone-500">
                      <span>Entrega</span>
                      <span>{brl(delivery)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-black/5 pt-3 text-[13px] font-semibold">
                    <span>Total</span>
                    <span className="text-brand">{brl(total + delivery)}</span>
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-stone-400">Cliente ainda não adicionou itens.</p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Observação</p>
              <p className="rounded-md bg-stone-50 px-2.5 py-2 text-[12px] text-pretty ring-1 ring-black/5">
                {chat.note}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Entrega</p>
              <p className="text-[12px] text-pretty">{chat.address}</p>
              <p className="text-[11px] text-stone-400">
                {chat.addressRef} · {chat.eta}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
