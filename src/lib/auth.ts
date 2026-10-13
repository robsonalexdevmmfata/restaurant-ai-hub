import { useEffect, useState } from "react";
import { clearToken } from "./api";

export type AppRole = "super_admin" | "owner" | "cozinha" | "caixa" | "motoboy";

export type Tenant = {
  id: string;
  email: string;
  restaurant: string;
  restaurantId: string;
  restaurantSlug: string;
  owner: string;
  name: string;
  role: AppRole;
  avatar: string;
};

export type RestaurantStaffMember = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Exclude<AppRole, "super_admin" | "owner">;
  restaurant: string;
  restaurantSlug: string;
  owner: string;
  avatar: string;
};

export type AuthSession = {
  user: Tenant;
};

const KEY = "restauranteai.session";
const STAFF_KEY = "restauranteai.staff";

export const DEMO_ACCOUNTS: Record<
  AppRole,
  {
    email: string;
    password: string;
    name: string;
    restaurant: string;
    restaurantId: string;
    restaurantSlug: string;
    owner: string;
    avatar: string;
    role: AppRole;
  }
> = {
  super_admin: {
    email: "admin@restaurantai.com",
    password: "admin123",
    name: "Maria Souza",
    restaurant: "Rede RestauranteAI",
    restaurantId: "global",
    restaurantSlug: "rede-restaurantai",
    owner: "Super Admin",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
    role: "super_admin",
  },
  owner: {
    email: "dono@pizzariavulcao.com.br",
    password: "owner123",
    name: "Marco Silva",
    restaurant: "Pizzaria Vulcão",
    restaurantId: "pv-001",
    restaurantSlug: "pizzaria-vulcao",
    owner: "Marco Silva",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80",
    role: "owner",
  },
  cozinha: {
    email: "cozinha@pizzariavulcao.com.br",
    password: "cozinha123",
    name: "Ana Rocha",
    restaurant: "Pizzaria Vulcão",
    restaurantId: "pv-001",
    restaurantSlug: "pizzaria-vulcao",
    owner: "Marco Silva",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80",
    role: "cozinha",
  },
  caixa: {
    email: "caixa@pizzariavulcao.com.br",
    password: "caixa123",
    name: "Lucas Mendes",
    restaurant: "Pizzaria Vulcão",
    restaurantId: "pv-001",
    restaurantSlug: "pizzaria-vulcao",
    owner: "Marco Silva",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80",
    role: "caixa",
  },
  motoboy: {
    email: "motoboy@pizzariavulcao.com.br",
    password: "motoboy123",
    name: "Rafael Costa",
    restaurant: "Pizzaria Vulcão",
    restaurantId: "pv-001",
    restaurantSlug: "pizzaria-vulcao",
    owner: "Marco Silva",
    avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80",
    role: "motoboy",
  },
};

export function getDefaultRouteForRole(role: AppRole) {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "owner":
      return "/dashboard";
    case "cozinha":
      return "/cozinha";
    case "caixa":
      return "/caixa";
    case "motoboy":
      return "/motoboy";
    default:
      return "/login";
  }
}

export function getRestaurantStaffMap(): Record<string, RestaurantStaffMember[]> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STAFF_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, RestaurantStaffMember[]>) : {};
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function getRestaurantStaff(slug: string): RestaurantStaffMember[] {
  return getRestaurantStaffMap()[slug] ?? [];
}

export function createRestaurantStaffAccount(input: {
  name: string;
  email: string;
  password: string;
  role: Exclude<AppRole, "super_admin" | "owner">;
  restaurant: string;
  restaurantSlug: string;
  owner: string;
}) {
  if (typeof window === "undefined") return null;

  const map = getRestaurantStaffMap();
  const current = map[input.restaurantSlug] ?? [];
  const member: RestaurantStaffMember = {
    id: `${input.restaurantSlug}-${Date.now()}`,
    email: input.email.trim().toLowerCase(),
    password: input.password.trim(),
    name: input.name.trim(),
    role: input.role,
    restaurant: input.restaurant,
    restaurantSlug: input.restaurantSlug,
    owner: input.owner,
    avatar:
      input.role === "cozinha"
        ? "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80"
        : input.role === "caixa"
          ? "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80"
          : "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80",
  };

  map[input.restaurantSlug] = [...current, member];
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(map));
  return member;
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function getTenant(): Tenant | null {
  return getSession()?.user ?? null;
}

export function setSession(user: Tenant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify({ user }));
}

export function signIn(email: string, password?: string): Tenant {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password?.trim();

  const customAccounts = Object.values(getRestaurantStaffMap()).flat();
  const accountCandidates = [...Object.values(DEMO_ACCOUNTS), ...customAccounts];

  const account = accountCandidates.find((candidate) => {
    const sameEmail = candidate.email.toLowerCase() === normalizedEmail;
    const samePassword = normalizedPassword ? candidate.password === normalizedPassword : true;
    return sameEmail && samePassword;
  });

  if (!account) {
    throw new Error("Credenciais inválidas. Use um dos usuários de demonstração.");
  }

  const tenant: Tenant = {
    id: account.restaurantId ?? `${account.restaurantSlug}-tenant`,
    email: account.email,
    restaurant: account.restaurant,
    restaurantId: account.restaurantId ?? account.restaurantSlug,
    restaurantSlug: account.restaurantSlug ?? account.restaurantId ?? "pizzaria-vulcao",
    owner: account.owner,
    name: account.name,
    role: account.role,
    avatar: account.avatar,
  };

  setSession(tenant);
  return tenant;
}

export function signInAs(role: AppRole): Tenant {
  const account = DEMO_ACCOUNTS[role];
  const tenant: Tenant = {
    id: account.restaurantId,
    email: account.email,
    restaurant: account.restaurant,
    restaurantId: account.restaurantId,
    restaurantSlug: account.restaurantSlug,
    owner: account.owner,
    name: account.name,
    role: account.role,
    avatar: account.avatar,
  };

  setSession(tenant);
  return tenant;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  clearToken();
}

export function canAccessRole(user: Tenant | null, requiredRoles: AppRole | AppRole[]) {
  if (!user) return false;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(user.role);
}

export function useSession() {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionState(getSession());
    setLoading(false);
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/** Reads the simulated session on the client. `loading` is true until hydrated. */
export function useTenant() {
  const { user, loading } = useSession();
  return { tenant: user, loading };
}
