import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runRestaurantAgent } from "@/lib/agent-simulator";
import { brl, chats as seed, type Chat, type Message } from "@/lib/mock";
import { useTenantMenu } from "@/lib/menu-store";
import { useTenantOperations } from "@/lib/operations";
import { showToast } from "@/lib/toast";
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
  const { tenant, loading } = useRequireTenant(["owner", "gerente", "atendente"]);
  const slug = tenant?.restaurantSlug ?? "pizzaria-vulcao";
  const { items: activeMenu } = useTenantMenu(slug);
  const { update: updateOperations } = useTenantOperations(slug);
  const [chats, setChats] = useState<Chat[]>(seed);
  const [selectedId, setSelectedId] = useState(seed[0]!.id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [clientDraft, setClientDraft] = useState("");
  const [simulatorMessages, setSimulatorMessages] = useState<Message[]>([
    { id: "sim-welcome", sender: "ia", text: "Olá! Sou o atendente virtual. Pergunte sobre o cardápio ou me diga o que gostaria de pedir.", time: "Agora" },
  ]);
  const [simulatorDraft, setSimulatorDraft] = useState("");
  const [simulatorCart, setSimulatorCart] = useState<Chat["cart"]>([]);
  const [simulatorCustomer, setSimulatorCustomer] = useState("Cliente de teste");
  const [simulatorPhone, setSimulatorPhone] = useState("");
  const [simulatorAddress, setSimulatorAddress] = useState("");
  const [simulatorPostalCode, setSimulatorPostalCode] = useState("");
  const [simulatorOrderType, setSimulatorOrderType] = useState<"Salão" | "Delivery / WhatsApp">("Delivery / WhatsApp");
  const [simulatorPayment, setSimulatorPayment] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [simulatorWaitingForConfirmation, setSimulatorWaitingForConfirmation] = useState(false);
  const [simulatorHandoff, setSimulatorHandoff] = useState(false);

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

  function receiveCustomerMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = clientDraft.trim();
    if (!text) return;
    const customerMessage: Message = {
      id: `client-${Date.now()}`,
      sender: "cliente",
      text,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setClientDraft("");
    const response = chat.mode === "ia"
      ? runRestaurantAgent(text, activeMenu.filter((item) => item.available), chat.cart, false)
      : null;

    setChats((prev) => prev.map((current) => {
      if (current.id !== selectedId) return current;
      if (!response) return { ...current, messages: [...current.messages, customerMessage] };
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: "ia",
        text: response.reply,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      return {
        ...current,
        mode: response.handoff ? "humano" : current.mode,
        status: response.handoff ? "Requer Atendimento Humano" : current.status,
        cart: response.cart,
        messages: [...current.messages, customerMessage, agentMessage],
      };
    }));
    if (response?.handoff) {
      showToast({ title: "Requer Atendimento Humano", description: `${chat.name}: pedido especial identificado. O contexto foi preservado.`, variant: "warning" });
    }
  }

  function submitSimulatorMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = simulatorDraft.trim();
    if (!text) return;
    setSimulatorDraft("");

    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const customerMessage: Message = { id: `sim-client-${Date.now()}`, sender: "cliente", text, time };
    if (simulatorHandoff) {
      setSimulatorMessages((previous) => [...previous, customerMessage]);
      return;
    }

    const result = runRestaurantAgent(text, activeMenu.filter((item) => item.available), simulatorCart, simulatorWaitingForConfirmation);
    const isDeliveryConfirmation = result.confirmed && simulatorOrderType === "Delivery / WhatsApp" && !simulatorAddress.trim();
    const response = isDeliveryConfirmation
      ? { ...result, confirmed: false, waitingForConfirmation: true, reply: "Antes de confirmar, qual é o endereço completo da entrega?" }
      : result;
    const agentMessage: Message = { id: `sim-agent-${Date.now() + 1}`, sender: "ia", text: response.reply, time };
    setSimulatorMessages((previous) => [...previous, customerMessage, agentMessage]);
    setSimulatorCart(response.cart);
    setSimulatorWaitingForConfirmation(response.waitingForConfirmation);

    if (response.handoff) {
      setSimulatorHandoff(true);
      showToast({ title: "Requer Atendimento Humano", description: "A IA pausou e manteve o contexto do simulador.", variant: "warning" });
    }

    if (response.confirmed) {
      const orderId = `WA-${Date.now().toString().slice(-7)}`;
      const orderType = simulatorOrderType;
      updateOperations((current) => {
        const freeTable = orderType === "Salão" ? current.tables.find((table) => table.status === "Livre") : undefined;
        const orderTable = freeTable ? `Mesa ${freeTable.id}` : orderType === "Salão" ? "Salão" : "Delivery";
        const openedAt = new Date().toISOString();
        return {
          ...current,
          tables: freeTable
            ? current.tables.map((table) => table.id === freeTable.id
              ? { ...table, status: "Comanda Aberta", openedAt, openedBy: "Agente WhatsApp" }
              : table)
            : current.tables,
          orders: [
            {
              id: orderId,
              customer: simulatorCustomer.trim() || "Cliente WhatsApp",
              customerPhone: simulatorPhone.trim(),
              table: orderTable,
              address: orderType === "Salão" ? "Consumo no salão" : simulatorAddress.trim(),
              eta: "35 min",
              items: response.cart.map((item) => ({ ...item })),
              kitchenStatus: "Pendente",
              paymentStatus: "Pendente",
              requestedPaymentMethod: simulatorPayment,
              deliveryStatus: orderType === "Salão" ? "Entregue" : "Disponível",
              orderType,
              waitMinutes: 0,
              neighborhood: "Centro",
              distanceKm: 2,
              postalCode: simulatorPostalCode,
              trackingToken: crypto.randomUUID(),
              routeProgress: 0,
            },
            ...current.orders,
          ],
        };
      });
      setSimulatorWaitingForConfirmation(false);
      showToast({ title: "Pedido enviado", description: `${orderId} entrou na cozinha e está disponível no caixa.`, variant: "success" });
    }
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
      <Tabs defaultValue="inbox">
        <TabsList className="mb-4 bg-stone-200">
          <TabsTrigger value="inbox" className="text-[12px]">Conversas</TabsTrigger>
          <TabsTrigger value="simulador" className="text-[12px]">Simulador do Agente WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox">
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
            {chat.status === "Requer Atendimento Humano" && (
              <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                Requer Atendimento Humano · IA pausada; mensagens e carrinho foram preservados.
              </div>
            )}
            <button
              type="button"
              onClick={toggleMode}
              className="w-full rounded-md px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-black/10 transition-colors hover:bg-stone-50"
            >
              {chat.mode === "ia" ? "Pausar IA e assumir chat" : "Devolver conversa para a IA"}
            </button>
            <form onSubmit={receiveCustomerMessage} className="flex items-center gap-2">
              <input
                value={clientDraft}
                onChange={(e) => setClientDraft(e.target.value)}
                placeholder="Simular mensagem recebida do cliente..."
                className="min-w-0 flex-1 rounded-md bg-stone-50 px-3 py-2 text-[12px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30"
              />
              <button type="submit" aria-label="Enviar mensagem simulada do cliente" className="grid size-8 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-stone-700 hover:bg-stone-50">
                <Send className="size-4 rotate-180" />
              </button>
            </form>
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
        </TabsContent>

        <TabsContent value="simulador" className="mt-0">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="flex min-h-[620px] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold">Simulador do Agente WhatsApp</p>
                  <p className="mt-1 text-[11px] text-stone-500">Usando {activeMenu.filter((item) => item.available).length} itens ativos do cardápio deste tenant.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatorMessages([{ id: `sim-${Date.now()}`, sender: "ia", text: "Olá! Sou o atendente virtual. Pergunte sobre o cardápio ou me diga o que gostaria de pedir.", time: "Agora" }]);
                    setSimulatorCart([]);
                    setSimulatorWaitingForConfirmation(false);
                    setSimulatorHandoff(false);
                  }}
                  className="rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  Reiniciar teste
                </button>
              </div>
              {simulatorHandoff && (
                <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-800">
                  Requer Atendimento Humano · agente pausado com o contexto preservado.
                  <button type="button" onClick={() => setSimulatorHandoff(false)} className="ml-2 underline">Retomar IA</button>
                </div>
              )}
              <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
                {simulatorMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === "cliente" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 ring-1 ${message.sender === "cliente" ? "rounded-tl-sm bg-white ring-black/5" : "rounded-tr-sm bg-brand/10 ring-brand/15"}`}>
                      <p className="text-[13px] text-pretty">{message.text}</p>
                      <span className={`mt-1 block text-[10px] ${message.sender === "cliente" ? "text-stone-400" : "text-brand"}`}>
                        {message.sender === "cliente" ? simulatorCustomer || "Cliente" : "Agente IA"} · {message.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={submitSimulatorMessage} className="flex items-center gap-2 border-t border-black/5 p-3">
                <input
                  value={simulatorDraft}
                  onChange={(event) => setSimulatorDraft(event.target.value)}
                  placeholder={simulatorHandoff ? "IA pausada. Retome para continuar o teste." : "Ex.: Quero 2 margueritas e uma bebida..."}
                  disabled={simulatorHandoff}
                  className="min-w-0 flex-1 rounded-md bg-stone-50 px-3 py-2 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
                />
                <button type="submit" aria-label="Enviar mensagem ao agente" disabled={simulatorHandoff} className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white hover:bg-brand-deep disabled:bg-stone-300">
                  <Send className="size-4" />
                </button>
              </form>
            </Card>

            <div className="space-y-4">
              <Card className="space-y-3 p-4">
                <p className="text-[13px] font-semibold">Dados do cliente fictício</p>
                <label className="block text-[11px] font-medium text-stone-500">
                  Nome
                  <input value={simulatorCustomer} onChange={(event) => setSimulatorCustomer(event.target.value)} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink" />
                </label>
                <label className="block text-[11px] font-medium text-stone-500">
                  WhatsApp do cliente
                  <input value={simulatorPhone} onChange={(event) => setSimulatorPhone(event.target.value)} placeholder="+55 11 99999-0000" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink placeholder:text-stone-400" />
                </label>
                <label className="block text-[11px] font-medium text-stone-500">
                  Tipo do pedido
                  <select value={simulatorOrderType} onChange={(event) => setSimulatorOrderType(event.target.value as "Salão" | "Delivery / WhatsApp")} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink">
                    <option>Delivery / WhatsApp</option>
                    <option>Salão</option>
                  </select>
                </label>
                {simulatorOrderType === "Delivery / WhatsApp" && (
                  <>
                    <label className="block text-[11px] font-medium text-stone-500">
                      Endereço da entrega
                      <input value={simulatorAddress} onChange={(event) => setSimulatorAddress(event.target.value)} placeholder="Rua, número e bairro" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink placeholder:text-stone-400" />
                    </label>
                    <label className="block text-[11px] font-medium text-stone-500">
                      CEP de entrega
                      <input value={simulatorPostalCode} onChange={(event) => setSimulatorPostalCode(event.target.value)} placeholder="00000-000" inputMode="numeric" className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink placeholder:text-stone-400" />
                    </label>
                  </>
                )}
                <label className="block text-[11px] font-medium text-stone-500">
                  Forma de pagamento
                  <select value={simulatorPayment} onChange={(event) => setSimulatorPayment(event.target.value as "PIX" | "Cartão" | "Dinheiro")} className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] text-ink">
                    <option>PIX</option>
                    <option>Cartão</option>
                    <option>Dinheiro</option>
                  </select>
                </label>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                  <p className="text-[13px] font-semibold">Carrinho em montagem</p>
                  <span className="text-[11px] text-stone-500">{simulatorCart.reduce((sum, item) => sum + item.qty, 0)} itens</span>
                </div>
                {simulatorCart.length ? (
                  <div className="space-y-2 p-4">
                    {simulatorCart.map((item) => (
                      <div key={item.name} className="flex justify-between gap-2 text-[12px]">
                        <span>{item.qty}x {item.name}</span><span className="font-medium">{brl(item.qty * item.price)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-black/5 pt-3 text-[13px] font-semibold">
                      <span>Total</span><span className="text-brand">{brl(simulatorCart.reduce((sum, item) => sum + item.qty * item.price, 0))}</span>
                    </div>
                    <p className="text-[10px] text-stone-500">A confirmação do cliente envia o pedido para a cozinha e abre a comanda pendente no caixa.</p>
                  </div>
                ) : <p className="p-4 text-[12px] text-stone-500">Peça itens pelo chat para montar o carrinho.</p>}
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
