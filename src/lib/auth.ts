import { useEffect, useState } from "react";

const KEY = "restauranteai.tenant";

export type Tenant = {
  email: string;
  restaurant: string;
  owner: string;
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

export function signIn(email: string, restaurant?: string): Tenant {
  const tenant: Tenant = {
    email,
    restaurant: restaurant?.trim() || "Pizzaria Vulcão",
    owner: "Marco Silva",
  };
  window.localStorage.setItem(KEY, JSON.stringify(tenant));
  return tenant;
}

export function signOut() {
  window.localStorage.removeItem(KEY);
}

/** Reads the simulated session on the client. `loading` is true until hydrated. */
export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTenant(getTenant());
    setLoading(false);
  }, []);

  return { tenant, loading };
}
