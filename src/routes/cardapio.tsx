import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, Card } from "@/components/app-shell";
import { useLoad } from "@/components/kit";
import { brl, defaultPrompt } from "@/lib/mock";
import { apiAssetUrl, getToken, type ApiProduct, type ProductPayload } from "@/lib/api";
import { data } from "@/lib/data";
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
  const { categories: savedCategories, updateCategories } = useTenantMenu(tenant?.restaurantSlug ?? "pizzaria-vulcao");
  const productLoad = useLoad(() => data.listProducts(), [tenant?.restaurantSlug]);
  const products = productLoad.data ?? [];
  const categories = [...new Set([...savedCategories, ...products.map((product) => product.category).filter((category): category is string => Boolean(category))])];
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: "", category: "Pizzas salgadas", price: "39,90", description: "", imageUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [clearImage, setClearImage] = useState(false);

  useEffect(() => () => {
    if (imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  if (loading || !tenant) return <div className="min-h-screen bg-stone-100" />;

  async function toggle(product: ApiProduct) {
    try {
      await data.updateProduct(product.id, { status: product.status === "DISPONIVEL" ? "INDISPONIVEL" : "DISPONIVEL" });
      productLoad.reload();
    } catch (error) {
      showToast({ title: "Não foi possível atualizar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
    }
  }

  function openCreateForm() {
    setEditingItemId(null);
    setImageFile(null);
    setImagePreviewUrl("");
    setClearImage(false);
    setNewItem({ name: "", category: categories[0] ?? "", price: "39,90", description: "", imageUrl: "" });
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

  function openEditForm(item: ApiProduct) {
    setEditingItemId(item.id);
    setImageFile(null);
    setImagePreviewUrl("");
    setClearImage(false);
    setNewItem({
      name: item.name,
      category: item.category ?? "",
      price: Number(item.price).toFixed(2).replace(".", ","),
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingItemId(null);
    setImageFile(null);
    setImagePreviewUrl("");
    setClearImage(false);
    setNewItem({ name: "", category: "Pizzas salgadas", price: "39,90", description: "", imageUrl: "" });
  }

  function savePrompt() {
    setSaved(true);
    showToast({ title: "Instruções salvas", description: "O comportamento da IA foi atualizado com sucesso.", variant: "success" });
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newItem.name.trim();
    const description = newItem.description.trim();
    const price = Number(newItem.price.replace(",", "."));
    const imageUrl = newItem.imageUrl.trim();

    if (!name || !description || Number.isNaN(price) || price <= 0) return;

    if (imageFile && !getToken()) {
      showToast({
        title: "Conecte o backend para enviar fotos",
        description: "O upload persistente de fotos exige uma sessão autenticada no backend.",
        variant: "warning",
      });
      return;
    }

    try {
      const keepsUploadedImage = imageUrl.startsWith("/public/products/") && !imageFile && !clearImage;
      const input: ProductPayload = {
        name,
        description,
        price,
        category: newItem.category,
        ...((!keepsUploadedImage && !imageFile) ? { imageUrl: imageUrl || null } : {}),
      };
      let savedProduct: ApiProduct;
      if (editingItemId) {
        savedProduct = await data.updateProduct(editingItemId, input);
      } else {
        savedProduct = await data.createProduct(input);
      }

      if (clearImage && editingItemId && newItem.imageUrl.startsWith("/public/products/")) {
        await data.deleteProductImage(editingItemId);
      }
      if (imageFile) {
        try {
          const optimizedImage = await optimizeProductImage(imageFile);
          await data.uploadProductImage(savedProduct.id, optimizedImage);
        } catch (error) {
          await productLoad.reload();
          closeForm();
          showToast({
            title: "Produto salvo, mas a foto não foi enviada",
            description: error instanceof Error ? error.message : "Tente enviar a foto novamente.",
            variant: "warning",
          });
          return;
        }
      }
      await productLoad.reload();
      showToast({
        title: editingItemId ? "Item atualizado" : "Item adicionado",
        description: `${name} foi ${editingItemId ? "editado" : "incluído"} no cardápio.`,
        variant: "success",
      });
      closeForm();
    } catch (error) {
      showToast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "warning" });
    }
  }

  return (
    <AppShell
      tenant={tenant}
      title="Cardápio e agente"
      subtitle={`${tenant.restaurant} · ${products.filter((product) => product.status === "DISPONIVEL").length} de ${products.length} itens disponíveis`}
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
                <Plus className="mr-1 inline size-4" />Adicionar produto
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
              <section className="space-y-3 rounded-xl border border-black/5 bg-white p-3 md:col-span-2">
                <div>
                  <p className="text-[12px] font-semibold text-stone-700">Foto do produto</p>
                  <p className="mt-1 text-[11px] text-stone-500">O upload é otimizado e armazenado no PostgreSQL. JPG, PNG ou WebP · até 8 MB antes da otimização.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-deep">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
                          showToast({ title: "Foto não aceita", description: "Escolha JPG, PNG ou WebP com até 8 MB.", variant: "warning" });
                          return;
                        }
                        setImageFile(file);
                        setImagePreviewUrl(URL.createObjectURL(file));
                        setClearImage(false);
                      }}
                    />
                    <span>{imageFile ? "Trocar arquivo" : "Enviar foto"}</span>
                  </label>
                  {(imageFile || newItem.imageUrl) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreviewUrl("");
                        setNewItem((current) => ({ ...current, imageUrl: "" }));
                        setClearImage(true);
                      }}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Remover foto
                    </button>
                  ) : null}
                </div>
                {!imageFile && newItem.imageUrl ? (
                  <p className="text-[11px] text-emerald-700">Imagem cadastrada. Envie outro arquivo para substituí-la.</p>
                ) : null}
                {(imagePreviewUrl || (!clearImage && newItem.imageUrl)) ? (
                  <img
                    src={imagePreviewUrl || apiAssetUrl(newItem.imageUrl)}
                    alt="Prévia da foto do produto"
                    className="h-40 w-full rounded-xl bg-stone-100 object-cover"
                    onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                  />
                ) : (
                  <div className="grid h-32 place-items-center rounded-xl bg-stone-50 text-xs text-stone-400">Prévia da foto aparecerá aqui</div>
                )}
              </section>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-md bg-brand px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-deep">
                  {editingItemId ? "Salvar alterações" : "Salvar item"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            {productLoad.data && products.length === 0 && !productLoad.error ? (
              <div className="border-b border-black/5 px-4 py-10 text-center">
                <p className="text-sm font-semibold text-stone-700">Seu cardápio ainda está vazio</p>
                <p className="mt-1 text-[12px] text-stone-500">Cadastre o primeiro produto para publicar no cardápio e disponibilizar para a equipe.</p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep"
                >
                  <Plus className="size-4" /> Adicionar primeiro produto
                </button>
              </div>
            ) : null}
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
                {productLoad.error ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">{productLoad.error}</td></tr>
                ) : null}
                {!productLoad.error && productLoad.data === null ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-stone-500">Carregando produtos…</td></tr>
                ) : null}
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={apiAssetUrl(item.imageUrl)} alt="" loading="lazy" className="size-12 rounded-lg bg-stone-100 object-cover" />
                        ) : (
                          <div className="grid size-12 place-items-center rounded-lg bg-stone-100 text-[10px] text-stone-400">Sem foto</div>
                        )}
                        <div>
                          <p className="text-[13px] font-medium">{item.name}</p>
                          <p className="text-[12px] text-stone-500 text-pretty">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-stone-500">{item.category ?? "Outros"}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{brl(Number(item.price))}</td>
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
                          onClick={() => void toggle(item)}
                          className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                            item.status === "DISPONIVEL"
                              ? "bg-brand/10 text-brand hover:bg-brand/20"
                              : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                          }`}
                        >
                          {item.status === "DISPONIVEL" ? "Disponível" : "Indisponível"}
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

async function optimizeProductImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50_000_000) {
      throw new Error("A resolução da imagem é muito alta. Redimensione a foto e tente novamente.");
    }

    const scale = Math.min(1, 1440 / bitmap.width, 1080 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem neste navegador.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Não foi possível converter a imagem.");
    if (blob.size > 1_500_000) {
      throw new Error("A foto ainda ficou maior que 1,5 MB após a otimização. Tente uma imagem menor.");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler a foto selecionada."));
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Formato de imagem inválido."));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
