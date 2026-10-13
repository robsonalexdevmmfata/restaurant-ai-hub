import { useEffect, useState } from "react";

import { defaultDeliveryFeeSettings, type DeliveryFeeSettings } from "@/lib/operations";

export type TenantBranding = {
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  cnpj: string;
  displayName: string;
  description: string;
  coverUrl: string;
  openingHours: string;
  phone: string;
  address: string;
  isOpen: boolean;
  deliveryFees: DeliveryFeeSettings;
};

const STORAGE_PREFIX = "restaurantai.branding.";
const EVENT_NAME = "restaurantai:branding";

export const defaultTenantBranding: TenantBranding = {
  primaryColor: "#128c45",
  logoUrl: "",
  faviconUrl: "",
  cnpj: "",
  displayName: "",
  description: "",
  coverUrl: "",
  openingHours: "",
  phone: "",
  address: "",
  isOpen: true,
  deliveryFees: defaultDeliveryFeeSettings,
};

export function getTenantBranding(slug: string): TenantBranding {
  if (typeof window === "undefined") return defaultTenantBranding;
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<TenantBranding>;
      return {
        ...defaultTenantBranding,
        ...parsed,
        deliveryFees: {
          ...defaultDeliveryFeeSettings,
          ...parsed.deliveryFees,
          neighborhoodFees: parsed.deliveryFees?.neighborhoodFees ?? defaultDeliveryFeeSettings.neighborhoodFees,
        },
      };
    }
  } catch {
    // Return defaults if browser storage is unavailable or invalid.
  }
  return defaultTenantBranding;
}

export function updateTenantBranding(slug: string, branding: TenantBranding) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify(branding));
  } catch {
    // The current tab can continue using its in-memory form state if storage is full.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, branding } }));
}

export function useTenantBranding(slug: string) {
  const [branding, setBranding] = useState<TenantBranding>(defaultTenantBranding);

  useEffect(() => {
    setBranding(getTenantBranding(slug));
    const handleBranding = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; branding: TenantBranding }>).detail;
      if (detail?.slug === slug) setBranding(detail.branding);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `${STORAGE_PREFIX}${slug}`) setBranding(getTenantBranding(slug));
    };
    window.addEventListener(EVENT_NAME, handleBranding);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleBranding);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug]);

  return { branding, update: (next: TenantBranding) => updateTenantBranding(slug, next) };
}
