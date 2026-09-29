import { useEffect, useState } from "react";

export type SubscriptionStatus = "Ativa" | "Suspensa";
export type SubscriptionPlan = "Essencial" | "Profissional" | "Enterprise";

export type TenantSubscription = {
  restaurantSlug: string;
  restaurantName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  dueDate: string;
};

const STORAGE_KEY = "restaurantai.subscriptions";
export const SUBSCRIPTION_EVENT = "restaurantai:subscriptions";

const initialSubscriptions: TenantSubscription[] = [
  { restaurantSlug: "pizzaria-vulcao", restaurantName: "Pizzaria Vulcão", plan: "Profissional", status: "Ativa", dueDate: "10/10/2026" },
  { restaurantSlug: "burger-house", restaurantName: "Burger House", plan: "Essencial", status: "Ativa", dueDate: "05/10/2026" },
  { restaurantSlug: "cafe-aurora", restaurantName: "Café Aurora", plan: "Enterprise", status: "Ativa", dueDate: "18/10/2026" },
];

export function getSubscriptions(): TenantSubscription[] {
  if (typeof window === "undefined") return initialSubscriptions;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as TenantSubscription[];
  } catch {
    // Fall back to demo tenants when storage is unavailable or invalid.
  }
  return initialSubscriptions;
}

export function isSubscriptionSuspended(restaurantSlug: string) {
  return getSubscriptions().some(
    (subscription) => subscription.restaurantSlug === restaurantSlug && subscription.status === "Suspensa",
  );
}

export function updateSubscription(
  restaurantSlug: string,
  updater: (subscription: TenantSubscription) => TenantSubscription,
) {
  if (typeof window === "undefined") return;
  const subscriptions = getSubscriptions().map((subscription) =>
    subscription.restaurantSlug === restaurantSlug ? updater(subscription) : subscription,
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  } catch {
    // Keep the active admin session usable if browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(SUBSCRIPTION_EVENT, { detail: subscriptions }));
}

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);

  useEffect(() => {
    setSubscriptions(getSubscriptions());
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<TenantSubscription[]>).detail;
      if (Array.isArray(detail)) setSubscriptions(detail);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSubscriptions(getSubscriptions());
    };

    window.addEventListener(SUBSCRIPTION_EVENT, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SUBSCRIPTION_EVENT, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    subscriptions,
    update: (restaurantSlug: string, updater: (subscription: TenantSubscription) => TenantSubscription) =>
      updateSubscription(restaurantSlug, updater),
  };
}
