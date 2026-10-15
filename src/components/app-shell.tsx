import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutPanelLeft,
  MessageSquare,
  UtensilsCrossed,
  QrCode,
  LogOut,
  Store,
  Shield,
  Users,
  ChefHat,
  Banknote,
  Bike,
  BarChart3,
  PackageCheck,
  TableProperties,
  Palette,
  TicketPercent,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Btn } from "@/components/kit";
import { ProfileEditor } from "@/components/profile-editor";

import logo from "@/assets/logo.png";
import { signOut, type AppRole, type Tenant } from "@/lib/auth";
import { ToastViewport } from "@/lib/toast";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const ownerNavigation: AppNavItem[] = [
    { to: "/dashboard", label: "Visão geral", icon: LayoutPanelLeft },
    { to: "/conversas", label: "Conversas", icon: MessageSquare, badge: "3" },
    { to: "/cardapio", label: "Cardápio", icon: UtensilsCrossed },
    { to: "/personalizacao", label: "Personalização", icon: Palette },
    { to: "/promocoes", label: "Promoções", icon: TicketPercent },
    { to: "/mesas", label: "Mesas", icon: TableProperties },
    { to: "/pdv", label: "PDV", icon: Store },
    { to: "/cozinha", label: "Cozinha", icon: ChefHat },
    { to: "/delivery", label: "Delivery", icon: Bike },
    { to: "/caixa", label: "Caixa", icon: Banknote },
    { to: "/usuarios", label: "Usuários", icon: Users },
    { to: "/conexao", label: "Conexão", icon: QrCode },
];

const navByRole: Record<AppRole, AppNavItem[]> = {
  super_admin: [
    { to: "/admin", label: "Visão global", icon: BarChart3 },
    { to: "/admin#restaurantes", label: "Restaurantes", icon: Store },
    { to: "/admin#métricas", label: "Métricas", icon: Shield },
  ],
  owner: ownerNavigation,
  gerente: [...ownerNavigation, { to: "/motoboy", label: "Entregas", icon: Bike }],
  atendente: [
    { to: "/conversas", label: "Conversas", icon: MessageSquare },
  ],
  cozinha: [
    { to: "/cozinha", label: "Cozinha", icon: ChefHat },
    { to: "/cozinha#pedidos", label: "Pedidos", icon: PackageCheck },
  ],
  caixa: [
    { to: "/caixa", label: "Caixa", icon: Banknote },
    { to: "/pdv", label: "PDV balcão", icon: Store },
    { to: "/caixa#pagamentos", label: "Pagamentos", icon: PackageCheck },
  ],
  motoboy: [
    { to: "/motoboy", label: "Entregas", icon: Bike },
    { to: "/motoboy#rotas", label: "Rotas", icon: PackageCheck },
  ],
};

const roleLabel: Record<AppRole, string> = {
  super_admin: "Super Admin",
  owner: "Proprietário",
  gerente: "Gerente",
  atendente: "Atendimento",
  cozinha: "Cozinheira",
  caixa: "Caixa / PDV",
  motoboy: "Motoboy",
};

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
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    await navigate({ to: "/login", replace: true });
  }
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = navByRole[tenant.role] ?? navByRole.owner;

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
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <span className="px-2 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-600">Painel</span>
          {nav.map((item) => {
            const active = pathname === item.to || (item.to.includes("#") && pathname === (item.to.split("#")[0] ?? ""));
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
          <Link
            to="/r/$slug"
            params={{ slug: tenant.restaurantSlug }}
            target="_blank"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium hover:bg-white/5"
          >
            <ExternalLink className="size-4" />
            Cardápio público
          </Link>
        </nav>
        <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
          <img
            src={tenant.avatar}
            alt={tenant.name}
            loading="lazy"
            width={512}
            height={512}
            className="size-8 shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-white/10"
          />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-white">{tenant.name}</p>
            <p className="truncate text-[11px] text-stone-500">{roleLabel[tenant.role] ?? "Usuário"}</p>
          </div>
          <Btn
            variant="ghost"
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={() => void logout()}
            className="ml-auto size-8 shrink-0 p-0"
          >
            <LogOut className="size-4" />
          </Btn>
        </div>
      </aside>

      <main className="lg:ml-60">
        <ToastViewport />
        <header className="sticky top-0 z-20 border-b border-black/5 bg-stone-100/90 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold tracking-tight text-balance">{title}</h1>
              <p className="truncate text-[12px] text-stone-500">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <Btn variant="ghost" aria-label="Meu perfil" title="Meu perfil" onClick={() => setProfileOpen(true)} className="size-9 shrink-0 p-0">
                <img src={tenant.avatar} alt={tenant.name} className="size-7 rounded-full object-cover" />
              </Btn>
              <Btn variant="ghost" aria-label="Sair" title="Sair" onClick={() => void logout()} className="size-9 shrink-0 p-0"><LogOut className="size-4" /></Btn>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
        <nav className="sticky bottom-0 z-20 flex overflow-x-auto border-t border-black/5 bg-white lg:hidden">
          {nav.map((item) => {
            const active = pathname === item.to || (item.to.includes("#") && pathname === (item.to.split("#")[0] ?? ""));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-w-[68px] flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
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
      {profileOpen && <ProfileEditor tenant={tenant} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

export function Card({
  className = "",
  children,
  id,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className={`rounded-xl bg-white ring-1 ring-black/5 ${className}`}>
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}
