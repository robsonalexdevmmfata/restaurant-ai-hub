import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import logo from "@/assets/logo.png";
import { DEMO_ACCOUNTS, getDefaultRouteForRole, getSession, signIn, signInAs } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · RestaurantAI" },
      { name: "description", content: "Acesse a plataforma com demonstração multi-tenant por papel e perfil do restaurante." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_ACCOUNTS.owner.email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS.owner.password);
  const [loading, setLoading] = useState(false);
  const [suspensionNotice, setSuspensionNotice] = useState<string | null>(null);

  useEffect(() => {
    const suspendedRestaurant = window.sessionStorage.getItem("restaurantai.suspension-notice");
    if (suspendedRestaurant) {
      setSuspensionNotice(suspendedRestaurant);
      window.sessionStorage.removeItem("restaurantai.suspension-notice");
    }
    const session = getSession();
    if (session) {
      navigate({ to: getDefaultRouteForRole(session.user.role), replace: true });
    }
  }, [navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    window.setTimeout(() => {
      try {
        const user = signIn(email, password);
        navigate({ to: getDefaultRouteForRole(user.role), replace: true });
      } catch {
        window.alert("Credenciais inválidas. Use uma das contas de demonstração.");
      } finally {
        setLoading(false);
      }
    }, 600);
  }

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-ink antialiased lg:grid lg:grid-cols-[1fr_470px]">
      <section className="hidden flex-col justify-between bg-ink p-10 text-stone-300 lg:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="RestaurantAI" width={32} height={32} className="size-8 rounded-lg" />
          <div className="leading-none">
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">RestaurantAI</span>
            <p className="mt-0.5 text-[10px] text-stone-500">Multi-tenant SaaS</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white">
            Gestão completa da operação em um só painel.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-stone-400">
            Acesse as áreas por cargo: super admin, dono do restaurante, cozinheira, caixa e motoboy, com permissões isoladas por tenant.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 text-left">
            <div>
              <p className="font-display text-xl font-semibold text-white">3</p>
              <p className="text-[11px] text-stone-500">níveis de acesso</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-white">5</p>
              <p className="text-[11px] text-stone-500">perfis de usuário</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-white">1</p>
              <p className="text-[11px] text-stone-500">plataforma multi-tenant</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-stone-600">Demonstração de RBAC · dados simulados</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[1.5rem] border border-black/5 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Acesso</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Entrar no painel</h1>
            </div>
            <Link to="/" className="text-sm font-medium text-stone-500 hover:text-ink">
              Voltar ao site
            </Link>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">E-mail</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-stone-50 px-3 py-2.5 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Senha</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md bg-stone-50 px-3 py-2.5 text-[13px] ring-1 ring-black/5 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand px-3 py-2.5 text-[13px] font-medium text-white transition hover:bg-brand-deep disabled:opacity-70"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {suspensionNotice && (
            <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
              O acesso de {suspensionNotice} está suspenso. Entre em contato com o administrador da plataforma.
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-stone-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Contas de demonstração</p>
            <div className="mt-3 grid gap-2">
              {Object.values(DEMO_ACCOUNTS).map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    const user = signInAs(account.role);
                    navigate({ to: getDefaultRouteForRole(user.role), replace: true });
                  }}
                  className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-left text-sm transition hover:bg-stone-50"
                >
                  <span>
                    <span className="font-medium text-ink">{account.name}</span>
                    <span className="ml-2 text-stone-500">({account.role})</span>
                  </span>
                  <span className="text-[11px] text-brand">Entrar</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
