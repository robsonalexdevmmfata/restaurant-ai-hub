import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutPanelLeft, MessageSquare, UtensilsCrossed, QrCode, LogOut, Store } from "lucide-react";
import type { ReactNode } from "react";

import logo from "@/assets/logo.png";
import owner from "@/assets/owner.jpg";
import { signOut, type Tenant } from "@/lib/auth";

const nav = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutPanelLeft },
  { to: "/conversas", label: "Conversas", icon: MessageSquare, badge: "3" },
  { to: "/cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/conexao", label: "Conexão", icon: QrCode },
] as const;

export function AppShell({
  tenant,
  title,
  subtitle,
  action,
  children,
}: {
  tenant: Tenant;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-stone-100 text-ink font-sans antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink text-stone-300 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <img src={logo} alt="RestauranteAI" width={32} height={32} className="size-8 rounded-lg" />
          <div className="leading-none">
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">RestauranteAI</span>
            <p className="mt-0.5 text-[10px] text-stone-500">Operations</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <span className="px-2 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-600">Painel</span>
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  active ? "bg-white/5 text-white" : "hover:bg-white/5"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
                {"badge" in item && item.badge ? (
                  <span className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          <span className="mt-4 block px-2 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-600">
            Restaurante
          </span>
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium">
            <Store className="size-4" />
            {tenant.restaurant}
          </div>
        </nav>
        <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
          <img
            src={owner}
            alt={tenant.owner}
            loading="lazy"
            width={512}
            height={512}
            className="size-8 shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-white/10"
          />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-white">{tenant.owner}</p>
            <p className="truncate text-[11px] text-stone-500">Proprietário</p>
          </div>
          <button
            type="button"
            aria-label="Sair"
            onClick={() => {
              signOut();
              navigate({ to: "/", replace: true });
            }}
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-stone-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <main className="lg:ml-60">
        <header className="sticky top-0 z-20 border-b border-black/5 bg-stone-100/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold tracking-tight text-balance">{title}</h1>
              <p className="truncate text-[12px] text-stone-500">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-black/5 sm:inline-flex">
                <span className="size-1.5 rounded-full bg-brand" /> IA ativa
              </span>
              {action}
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
        <nav className="sticky bottom-0 z-20 flex border-t border-black/5 bg-white lg:hidden">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                  active ? "text-brand" : "text-stone-500"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl bg-white ring-1 ring-black/5 ${className}`}>{children}</div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}
