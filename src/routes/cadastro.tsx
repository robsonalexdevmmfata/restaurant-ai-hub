import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Utensils } from "lucide-react";

import logo from "@/assets/logo.png";
import { registerOwner, type Tenant } from "@/lib/auth";

const plans: {
  id: NonNullable<Tenant["subscriptionPlan"]>;
  price: string;
  description: string;
}[] = [
  { id: "Essencial", price: "R$ 99/mês", description: "O essencial para organizar e vender." },
  { id: "Profissional", price: "R$ 249/mês", description: "Mais automação para sua operação crescer." },
  { id: "Enterprise", price: "Sob medida", description: "Para redes e operações personalizadas." },
];

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan: typeof search["plan"] === "string" ? search["plan"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar conta — RestauranteAI" },
      { property: "og:title", content: "Criar conta — RestauranteAI" },
      { property: "og:description", content: "Crie a conta do seu restaurante e escolha seu plano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Crie a conta do seu restaurante e escolha seu plano." },
    ],
  }),
  component: Registration,
});

function Registration() {
  const { plan: initialPlan } = Route.useSearch();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<NonNullable<Tenant["subscriptionPlan"]>>(
    plans.find((item) => item.id === initialPlan)?.id ?? "Profissional",
  );
  const [ownerName, setOwnerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await registerOwner({
        ownerName: ownerName.trim(),
        restaurantName: restaurantName.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        password,
        plan,
      });
      await navigate({ to: "/dashboard", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar sua conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 font-sans text-ink sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-ink">
          <ArrowLeft className="size-4" /> Voltar ao site
        </Link>
        <section className="mt-5 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-9">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RestauranteAI" className="size-11 rounded-xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Comece por aqui</p>
              <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Crie a conta do seu restaurante</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Você já entra como proprietário, escolhe um plano e configura sua loja com a ajuda do nosso guia. A contratação está em modo simulado; nenhum pagamento será cobrado agora.
          </p>

          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-6">
            <fieldset>
              <legend className="text-sm font-semibold">Escolha um plano</legend>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {plans.map((item) => {
                  const selected = plan === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPlan(item.id)}
                      className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-stone-200 hover:border-stone-300"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-display text-lg font-semibold">{item.id}</span>
                        <span className={`grid size-5 place-items-center rounded-full ${selected ? "bg-brand text-white" : "border border-stone-300 text-transparent"}`}>
                          <Check className="size-3" />
                        </span>
                      </span>
                      <span className="mt-2 block text-lg font-bold">{item.price}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-stone-500">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-stone-700">
                Seu nome
                <input required minLength={2} autoComplete="name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
              </label>
              <label className="text-xs font-semibold text-stone-700">
                Nome do restaurante
                <input required minLength={2} autoComplete="organization" value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
              </label>
              <label className="text-xs font-semibold text-stone-700">
                E-mail de acesso
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
              </label>
              <label className="text-xs font-semibold text-stone-700">
                WhatsApp
                <input required type="tel" autoComplete="tel" inputMode="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="(11) 99999-9999" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
              </label>
              <label className="text-xs font-semibold text-stone-700 sm:col-span-2">
                Crie uma senha
                <input required minLength={6} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                <span className="mt-1 block font-normal text-stone-500">Mínimo de 6 caracteres.</span>
              </label>
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button disabled={saving} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60">
              <Utensils className="size-4" />
              {saving ? "Criando sua loja..." : "Criar conta e configurar restaurante"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-stone-500">
            Já tem uma conta? <Link to="/login" className="font-semibold text-brand hover:underline">Entrar</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
