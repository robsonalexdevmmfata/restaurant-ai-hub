import { useEffect, useState } from "react";
import { api, ApiError, clearToken, setToken } from "./api";

export type AppRole =
  "super_admin" | "owner" | "gerente" | "atendente" | "cozinha" | "caixa" | "motoboy";

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
  subscriptionPlan?: "Essencial" | "Profissional" | "Enterprise";
};

export type RestaurantStaffMember = {
  id: string;
  restaurantId?: string;
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
export const ONBOARDING_PENDING_KEY = "restaurantai.onboarding.pending";

type DemoRole = "super_admin" | "owner" | "cozinha" | "caixa" | "motoboy";

export const DEMO_ACCOUNTS: Record<
  DemoRole,
  {
    email: string;
    password: string;
    name: string;
    restaurant: string;
    restaurantId: string;
    restaurantSlug: string;
    owner: string;
    avatar: string;
    role: DemoRole;
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
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
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
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80",
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
    avatar:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80",
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
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80",
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
    avatar:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80",
    role: "motoboy",
  },
};

export function getDefaultRouteForRole(role: AppRole) {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "owner":
    case "gerente":
      return "/dashboard";
    case "atendente":
      return "/conversas";
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
  window.dispatchEvent(new Event("restaurantai:session"));
}

export function updateProfile(input: Pick<Tenant, "name" | "avatar">) {
  const current = getTenant();
  if (!current) throw new Error("Entre novamente para editar seu perfil.");
  const name = input.name.trim();
  if (!name) throw new Error("Informe seu nome.");
  const next = { ...current, name, avatar: input.avatar };
  window.localStorage.setItem(`restaurantai.profile.${current.email}`, JSON.stringify(input));
  setSession(next);
  return next;
}

export function updateTenantRestaurant(input: Pick<Tenant, "restaurant" | "restaurantSlug">) {
  const current = getTenant();
  if (!current) throw new Error("Entre novamente para atualizar os dados do restaurante.");
  const next = { ...current, ...input };
  setSession(next);
  return next;
}

function restoreProfile(tenant: Tenant): Tenant {
  try {
    const raw = window.localStorage.getItem(`restaurantai.profile.${tenant.email}`);
    if (!raw) return tenant;
    const profile = JSON.parse(raw) as Pick<Tenant, "name" | "avatar">;
    return {
      ...tenant,
      name: profile.name || tenant.name,
      avatar: profile.avatar || tenant.avatar,
    };
  } catch {
    return tenant;
  }
}

function normalizeApiRole(role: string): AppRole {
  if (
    role === "super_admin" ||
    role === "owner" ||
    role === "gerente" ||
    role === "atendente" ||
    role === "cozinha" ||
    role === "caixa" ||
    role === "motoboy"
  )
    return role;
  throw new Error("Este perfil ainda não possui uma área de acesso configurada.");
}

function signInDemo(email: string, password: string): Tenant {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const accountCandidates = Object.values(DEMO_ACCOUNTS);

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

  const user = restoreProfile(tenant);
  clearToken();
  setSession(user);
  return user;
}

export async function signIn(email: string, password: string): Promise<Tenant> {
  try {
    const response = await api.login(email.trim().toLowerCase(), password);
    const role = normalizeApiRole(response.user.role);
    setToken(response.token);
    const tenant: Tenant = {
      id: String(response.user.id),
      email: response.user.email,
      restaurant: response.restaurant.name,
      restaurantId: String(response.restaurant.id),
      restaurantSlug: response.restaurant.slug,
      subscriptionPlan: response.restaurant.subscriptionPlan,
      owner: response.restaurant.name,
      name: response.user.name ?? response.user.email,
      role,
      avatar:
        Object.values(DEMO_ACCOUNTS).find((account) => account.role === role)?.avatar ??
        DEMO_ACCOUNTS.owner.avatar,
    };
    setSession(tenant);
    return tenant;
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      return signInDemo(email, password);
    }
    throw error;
  }
}

export async function registerOwner(input: {
  ownerName: string;
  restaurantName: string;
  email: string;
  password: string;
  whatsapp: string;
  plan: NonNullable<Tenant["subscriptionPlan"]>;
}) {
  const response = await api.register(input);
  const tenant: Tenant = {
    id: String(response.user.id),
    email: response.user.email,
    restaurant: response.restaurant.name,
    restaurantId: String(response.restaurant.id),
    restaurantSlug: response.restaurant.slug,
    subscriptionPlan: response.restaurant.subscriptionPlan,
    owner: response.restaurant.name,
    name: response.user.name ?? input.ownerName,
    role: "owner",
    avatar: DEMO_ACCOUNTS.owner.avatar,
  };
  setToken(response.token);
  setSession(tenant);
  window.localStorage.setItem(ONBOARDING_PENDING_KEY, tenant.restaurantSlug);
  return tenant;
}

export function signInAs(role: DemoRole): Tenant {
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

  const user = restoreProfile(tenant);
  clearToken();
  setSession(user);
  return user;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  clearToken();
  window.dispatchEvent(new Event("restaurantai:session"));
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
    const refresh = () => setSessionState(getSession());
    refresh();
    setLoading(false);
    window.addEventListener("restaurantai:session", refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("restaurantai:session", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/** Reads the simulated session on the client. `loading` is true until hydrated. */
export function useTenant() {
  const { user, loading } = useSession();
  return { tenant: user, loading };
}
