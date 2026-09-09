import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useTenant } from "./auth";

/** Simulated multi-tenant guard: sends visitors without a session back to login. */
export function useRequireTenant() {
  const { tenant, loading } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !tenant) navigate({ to: "/", replace: true });
  }, [loading, tenant, navigate]);

  return { tenant, loading };
}
