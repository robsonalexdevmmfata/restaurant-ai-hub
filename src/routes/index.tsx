import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import logo from "@/assets/logo.png";
import { getTenant, signIn } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar · RestauranteAI" },
      {
        name: "description",
        content: "Acesse o painel do seu restaurante e acompanhe o agente de IA que atende no WhatsApp.",
      },
      { property: "og:title", content: "Entrar · RestauranteAI" },
      {
        property: "og:description",
        content: "Acesse o painel do seu restaurante e acompanhe o agente de IA que atende no WhatsApp.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("marco@pizzariavulcao.com.br");
  const [password, setPassword] = useState("123456");
  const [restaurant, setRestaurant] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getTenant()) navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      signIn(email, mode === "signup" ? restaurant : undefined);
      navigate({ to: "/dashboard", replace: true });
    }, 900);
  }

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-ink antialiased lg:grid lg:grid-cols-[1fr_460px]">
      <section className="hidden flex-col justify-between bg-ink p-10 text-stone-300 lg:flex">
        <div className="flex items-center gap-2">
          <img src={logo} alt="RestauranteAI" width={32} height={32} className="size-8 rounded-lg" />
          <div className="leading-none">
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">RestauranteAI</span>
            <p className="mt-0.5 text-[10px] text-stone-500">Operations</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-balance text-white">
            Seu atendente de IA no WhatsApp, com você no controle.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-stone-400 text-pretty">
            Acompanhe conversas em tempo real, assuma o chat quando quiser, ajuste o cardápio que a IA lê e veja o
            faturamento do dia num só lugar.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div>
              <p className="font-display text-xl font-semibold text-white">94%</p>
              <p className="text-[11px] text-stone-500">resolução pela IA</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-white">482</p>
              <p className="text-[11px] text-stone-500">atendimentos/dia</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-white">24/7</p>
              <p className="text-[11px] text-stone-500">sem fila de espera</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-stone-600">Ambiente de demonstração · dados simulados</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <img src={logo} alt="RestauranteAI" width={32} height={32} className="size-8 rounded-lg" />
            <span className="font-display text-[15px] font-semibold tracking-tight">RestauranteAI</span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {mode === "login" ? "Entrar no painel" : "Criar conta do restaurante"}
          </h1>
          <p className="mt-1 text-[12px] text-stone-500">
            {mode === "login"
              ? "Use o e-mail cadastrado do restaurante."
              : "Cada restaurante tem um painel isolado dos demais."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Restaurante</span>
                <input
                  required
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                  placeholder="Pizzaria Vulcão"
                  className="mt-1.5 w-full rounded-md bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/40"
                />
              </label>
            )}
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">E-mail</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Senha</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand px-3 py-2.5 text-[13px] font-medium text-white ring-1 ring-brand/30 transition-colors hover:bg-brand-deep disabled:opacity-70"
            >
              {loading ? "Entrando…" : mode === "login" ? "Entrar" : "Criar painel"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-4 text-[12px] font-medium text-stone-500 underline-offset-4 hover:text-ink hover:underline"
          >
            {mode === "login" ? "Não tenho conta ainda" : "Já tenho conta, quero entrar"}
          </button>
        </div>
      </section>
    </div>
  );
}
