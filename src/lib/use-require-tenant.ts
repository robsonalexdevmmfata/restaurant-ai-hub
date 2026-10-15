import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { signOut, type AppRole, useTenant } from "./auth";
import { isSubscriptionSuspended, SUBSCRIPTION_EVENT } from "./billing";

/** Simulated multi-tenant guard: sends visitors without a session back to login. */
export function useRequireTenant(requiredRole?: AppRole | AppRole[]) {
  const { tenant, loading } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!tenant) {
      navigate({ to: "/login", replace: true });
      return;
    }

    const requiredRoles = requiredRole
      ? Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      : [];
    const roleAllowed =
      tenant.role === "owner" ||
      tenant.role === "gerente" ||
      requiredRoles.includes(tenant.role);
    if (requiredRole && !roleAllowed) {
      navigate({ to: "/login", replace: true });
      return;
    }

    const enforceSubscription = () => {
      if (tenant.role === "super_admin" || !isSubscriptionSuspended(tenant.restaurantSlug)) return;
      window.sessionStorage.setItem("restaurantai.suspension-notice", tenant.restaurant);
      signOut();
      navigate({ to: "/login", replace: true });
    };

    enforceSubscription();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "restaurantai.subscriptions") enforceSubscription();
    };
    window.addEventListener(SUBSCRIPTION_EVENT, enforceSubscription);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SUBSCRIPTION_EVENT, enforceSubscription);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loading, navigate, requiredRole, tenant]);

  return { tenant, loading };
}
