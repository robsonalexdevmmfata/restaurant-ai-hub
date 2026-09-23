import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Empty, Field, inputCls, Modal, PageGate, useLoad } from "@/components/kit";
import { brl, type ApiMenu, type ApiProduct } from "@/lib/api";
import { data } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápios e agente · RestauranteAI" },
      { name: "description", content: "Crie cardápios, cadastre, edite e exclua produtos e ajuste as instruções do agente de IA." },
      { property: "og:title", content: "Cardápios e agente · RestauranteAI" },
      { property: "og:description", content: "Cardápios, produtos, preços e instruções do agente de IA." },
    ],
  }),
  component: Cardapio,
});

type Draft = { id?: number; name: string; description: string; price: string; category: string; available: boolean };
const emptyDraft: Draft = { name: "", description: "", price: "", category: "", available: true };

function Cardapio() {
  const { tenant, loading } = useRequireTenant();
  const menus = useLoad(() => data.listMenus());
  const [menuId, setMenuId] = useState<number | null>(null);
  const products = useLoad(() => (menuId ? data.listProducts(menuId) : Promise.resolve([] as ApiProduct[])), [menuId]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menuModal, setMenuModal] = useState<{ id?: number; name: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [msg, setMsg] = useState("");

  const current = menus.data?.find((m) => m.id === menuId) ?? null;

  useEffect(() => {
    if (!menus.data) return;
    if (!menuId || !menus.data.some((m) => m.id === menuId)) {
      setMenuId((menus.data.find((m) => m.isActive) ?? menus.data[0])?.id ?? null);
    }
  }, [menus.data, menuId]);

  useEffect(() => setPrompt(current?.aiInstructions ?? ""), [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !tenant) return <PageGate />;

  function flash(t: string) {
    setMsg(t);
    window.setTimeout(() => setMsg(""), 2500);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !menuId) return;
    const payload = {
      menuId,
      name: draft.name,
      description: draft.description || undefined,
      price: Number(draft.price.replace(",", ".")),
      category: draft.category || undefined,
      status: draft.available ? ("DISPONIVEL" as const) : ("INDISPONIVEL" as const),
    };
    if (draft.id) await data.updateProduct(draft.id, payload);
    else await data.createProduct(payload);
    setDraft(null);
    products.reload();
    menus.reload();
  }

  async function removeProduct(p: ApiProduct) {
    if (!window.confirm(`Excluir "${p.name}"?`)) return;
    await data.deleteProduct(p.id);
    products.reload();
    menus.reload();
  }

  async function toggle(p: ApiProduct) {
    await data.updateProduct(p.id, { status: p.status === "DISPONIVEL" ? "INDISPONIVEL" : "DISPONIVEL" });
    products.reload();
  }

  async function saveMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!menuModal) return;
    if (menuModal.id) await data.updateMenu(menuModal.id, { name: menuModal.name });
    else {
      const m = await data.createMenu({ name: menuModal.name });
      setMenuId(m.id);
    }
    setMenuModal(null);
    menus.reload();
  }

  async function removeMenu(m: ApiMenu) {
    if (!window.confirm(`Excluir o cardápio "${m.name}" e todos os produtos dele?`)) return;
    await data.deleteMenu(m.id);
    setMenuId(null);
    menus.reload();
  }

  async function activate(m: ApiMenu) {
    await data.updateMenu(m.id, { isActive: true });
    menus.reload();
    flash("Cardápio ativado para a IA");
  }

  async function savePrompt() {
    if (!current) return;
    await data.updateMenu(current.id, { aiInstructions: prompt });
    menus.reload();
    flash("Instruções salvas");
  }

  const items = products.data ?? [];

  return (
    <AppShell
      tenant={tenant}
      title="Cardápios e agente"
      subtitle={`${tenant.restaurant} · ${menus.data?.length ?? 0} cardápio(s)`}
      action={
        <Btn onClick={() => setMenuModal({ name: "" })}>
          <Plus className="size-4" /> Novo cardápio
        </Btn>
      }
    >
      {menus.error && <p className="mb-3 text-[12px] text-red-600">{menus.error}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        {!menus.data && <Skeleton className="h-9 w-48" />}
        {menus.data?.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMenuId(m.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium ring-1 transition-colors ${
              m.id === menuId ? "bg-ink text-white ring-ink" : "bg-white ring-black/10 hover:bg-stone-50"
            }`}
          >
            {m.name}
            {m.isActive && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">IA</span>}
            <span className="text-[11px] opacity-60">{m.productCount ?? ""}</span>
          </button>
        ))}
      </div>

      {menus.data && menus.data.length === 0 ? (
        <Card>
          <Empty>
            Você ainda não tem cardápio. <br />
            <Btn className="mt-3" onClick={() => setMenuModal({ name: "" })}>
              <Plus className="size-4" /> Criar meu primeiro cardápio
            </Btn>
          </Empty>
        </Card>
      ) : (
        current && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-3">
                <div className="mr-auto">
                  <p className="text-[13px] font-semibold">{current.name}</p>
                  <p className="text-[11px] text-stone-400">Link da IA: /menu/{current.slug}</p>
                </div>
                {!current.isActive && (
                  <Btn variant="ghost" onClick={() => activate(current)}>
                    Usar na IA
                  </Btn>
                )}
                <Btn variant="ghost" onClick={() => setMenuModal({ id: current.id, name: current.name })}>
                  <Pencil className="size-3.5" /> Renomear
                </Btn>
                <Btn variant="danger" onClick={() => removeMenu(current)}>
                  <Trash2 className="size-3.5" /> Excluir cardápio
                </Btn>
                <Btn onClick={() => setDraft({ ...emptyDraft })}>
                  <Plus className="size-4" /> Adicionar produto
                </Btn>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-black/5 text-[10px] uppercase tracking-[0.12em] text-stone-400">
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="px-4 py-2.5 font-medium">Categoria</th>
                      <th className="px-4 py-2.5 font-medium">Preço</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium">{item.name}</p>
                          <p className="text-[12px] text-stone-500 text-pretty">{item.description}</p>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-stone-500">{item.category ?? "—"}</td>
                        <td className="px-4 py-3 text-[13px] font-medium">{brl(item.price)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggle(item)}
                            className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              item.status === "DISPONIVEL" ? "bg-brand/10 text-brand" : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {item.status === "DISPONIVEL" ? "Disponível" : "Indisponível"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label="Editar"
                              onClick={() =>
                                setDraft({
                                  id: item.id,
                                  name: item.name,
                                  description: item.description ?? "",
                                  price: Number(item.price).toFixed(2),
                                  category: item.category ?? "",
                                  available: item.status === "DISPONIVEL",
                                })
                              }
                              className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-ink"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Excluir"
                              onClick={() => removeProduct(item)}
                              className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.data && items.length === 0 && <Empty>Nenhum produto neste cardápio ainda.</Empty>}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[13px] font-semibold">Instruções da IA · {current.name}</p>
              <p className="mt-1 text-[12px] text-stone-500 text-pretty">
                Tom, regras de venda e quando transferir para um atendente humano.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={14}
                placeholder="Você é o atendente da Pizzaria X, seja educado, ofereça borda recheada..."
                className="mt-3 w-full resize-none rounded-md bg-stone-50 px-3 py-2.5 text-[12px] leading-relaxed ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-brand/30"
              />
              <div className="mt-3 flex items-center gap-2">
                <Btn onClick={savePrompt}>Salvar instruções</Btn>
                {msg && <span className="text-[12px] font-medium text-brand">{msg}</span>}
              </div>
            </Card>
          </div>
        )
      )}

      <Modal open={!!draft} title={draft?.id ? "Editar produto" : "Novo produto"} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={saveProduct} className="space-y-3">
            <Field label="Nome">
              <input required className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Descrição">
              <textarea rows={2} className={inputCls} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço (R$)">
                <input required inputMode="decimal" className={inputCls} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              </Field>
              <Field label="Categoria">
                <input className={inputCls} placeholder="Pizzas" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.checked })} />
              Disponível para venda
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setDraft(null)}>Cancelar</Btn>
              <Btn type="submit">Salvar</Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!menuModal} title={menuModal?.id ? "Renomear cardápio" : "Novo cardápio"} onClose={() => setMenuModal(null)}>
        {menuModal && (
          <form onSubmit={saveMenu} className="space-y-3">
            <Field label="Nome do cardápio">
              <input required autoFocus className={inputCls} placeholder="Ex.: Almoço, Delivery, Fim de semana" value={menuModal.name} onChange={(e) => setMenuModal({ ...menuModal, name: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setMenuModal(null)}>Cancelar</Btn>
              <Btn type="submit">Salvar</Btn>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
