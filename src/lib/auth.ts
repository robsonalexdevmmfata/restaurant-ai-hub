import { useEffect, useState } from "react";

import { api, ApiError, clearToken, setToken } from "./api";
import { setDemoRestaurant } from "./data";

const KEY = "restauranteai.tenant";

export type Tenant = {
  email: string;
  restaurant: string;
  owner: string;
  role?: string;
  demo?: boolean;
};

export function getTenant(): Tenant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tenant) : null;
  } catch {
    return null;
  }
}

function store(t: Tenant) {
  window.localStorage.setItem(KEY, JSON.stringify(t));
  return t;
}

/** Login real no backend; se o servidor estiver offline entra no modo demonstração. */
export async function login(email: string, password: string): Promise<Tenant> {
  try {
    const r = await api.login(email, password);
    setToken(r.token);
    return store({ email, restaurant: r.restaurant.name, owner: r.user.name ?? email, role: r.user.role });
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) return signIn(email);
    throw e;
  }
}

export async function register(input: {
  restaurantName: string;
  ownerName: string;
  email: string;
  password: string;
  whatsapp?: string;
  city?: string;
}): Promise<Tenant> {
  try {
    const r = await api.register(input);
    setToken(r.token);
    return store({ email: input.email, restaurant: r.restaurant.name, owner: r.user.name ?? input.ownerName, role: r.user.role });
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      setDemoRestaurant(input.restaurantName);
      return signIn(input.email, input.restaurantName, input.ownerName);
    }
    throw e;
  }
}

export function signIn(email: string, restaurant?: string, owner?: string): Tenant {
  clearToken();
  return store({
    email,
    restaurant: restaurant?.trim() || "Pizzaria Vulcão",
    owner: owner?.trim() || "Marco Silva",
    role: "OWNER",
    demo: true,
  });
}

export function signOut() {
  window.localStorage.removeItem(KEY);
  clearToken();
}

/** Lê a sessão no cliente. `loading` fica true até hidratar. */
export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTenant(getTenant());
    setLoading(false);
  }, []);

  return { tenant, loading };
}
