import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { brl, defaultPrompt, type MenuItem } from "@/lib/mock";
import { useTenantMenu } from "@/lib/menu-store";
import { showToast } from "@/lib/toast";
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
  const { tenant, loading } = useRequireTenant("owner");
  const { items, update: updateMenu, categories, updateCategories } = useTenantMenu(tenant?.restaurantSlug ?? "pizzaria-vulcao");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", category: "Pizzas salgadas", price: "39,90", description: "" });

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  function toggle(id: string) {
    updateMenu((prev) => prev.map((item) => (item.id === id ? { ...item, available: !item.available } : item)));
  }

  function openCreateForm() {
    setEditingItemId(null);
    setNewItem({ name: "", category: categories[0] ?? "", price: "39,90", description: "" });
    setShowForm(true);
  }

  function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    if (categories.some((category) => category.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      showToast({ title: "Categoria já existe", description: "Escolha outro nome para a categoria.", variant: "warning" });
      return;
    }
    updateCategories([...categories, name]);
    setNewItem((current) => ({ ...current, category: name }));
    setCategoryDraft("");
    setShowCategoryForm(false);
    showToast({ title: "Categoria adicionada", description: `${name} já está disponível no formulário do cardápio.`, variant: "success" });
  }

  function openEditForm(item: MenuItem) {
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,
      category: item.category,
      price: item.price.toFixed(2).replace(".", ","),
      description: item.description,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingItemId(null);
    setNewItem({ name: "", category: "Pizzas salgadas", price: "39,90", description: "" });
  }

  function savePrompt() {
    setSaved(true);
    showToast({ title: "Instruções salvas", description: "O comportamento da IA foi atualizado com sucesso.", variant: "success" });
    window.setTimeout(() => setSaved(false), 2000);
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newItem.name.trim();
    const description = newItem.description.trim();
    const price = Number(newItem.price.replace(",", "."));

    if (!name || !description || Number.isNaN(price) || price <= 0) return;

    if (editingItemId) {
      updateMenu((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? { ...item, name, description, price, category: newItem.category }
            : item,
        ),
      );
      showToast({ title: "Item atualizado", description: `${name} foi editado com sucesso.`, variant: "success" });
    } else {
      updateMenu((prev) => [
        {
          id: `item-${Date.now()}`,
          name,
          description,
          price,
          category: newItem.category,
          available: true,
        },
        ...prev,
      ]);
      showToast({ title: "Item adicionado", description: `${name} foi incluído no cardápio.`, variant: "success" });
    }

    closeForm();
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
            <div>
              <p className="text-[13px] font-semibold">Itens lidos pela IA</p>
              <span className="text-[11px] text-stone-400">{categories.length} categorias</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryForm((current) => !current)}
                className="rounded-md border border-black/10 bg-white px-3 py-2 text-[12px] font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Adicionar Categoria
              </button>
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white transition hover:bg-brand-deep"
              >
                Adicionar item
              </button>
            </div>
          </div>

          {showCategoryForm && (
            <form onSubmit={addCategory} className="flex flex-col gap-2 border-b border-black/5 bg-emerald-50/50 p-4 sm:flex-row sm:items-end">
              <label className="block flex-1 text-[12px] font-medium text-stone-600">
                Nome da nova categoria
                <input
                  autoFocus
                  required
                  value={categoryDraft}
                  onChange={(event) => setCategoryDraft(event.target.value)}
                  placeholder="Ex.: Combos"
                  className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <button type="submit" className="rounded-md bg-brand px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-deep">Criar categoria</button>
            </form>
          )}

          {showForm && (
            <form onSubmit={addItem} className="grid gap-3 border-b border-black/5 bg-stone-50 p-4 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-stone-700">{editingItemId ? "Editar item" : "Novo item"}</p>
                <button type="button" onClick={closeForm} className="text-[12px] text-stone-500 hover:text-stone-700">
                  Fechar
                </button>
              </div>

              <label className="block text-[12px] text-stone-600">
                Nome do item
                <input
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <label className="block text-[12px] text-stone-600">
                Categoria
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="block text-[12px] text-stone-600">
                Preço
                <input
                  required
                  value={newItem.price}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, price: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <label className="block text-[12px] text-stone-600 md:col-span-2">
                Descrição
                <textarea
                  required
                  rows={3}
                  value={newItem.description}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-black/5 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                  {editingItemId ? "Salvar alterações" : "Salvar item"}
                </button>
              </div>
            </form>
          )}

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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-700 hover:bg-stone-200"
                        >
                          Editar
                        </button>
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
                      </div>
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
