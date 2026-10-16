import { useEffect, useState } from "react";
import { api } from "./api";

export type CouponKind = "percentual" | "valor-fixo" | "frete-gratis";

export type Coupon = {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  startsAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
};

const STORAGE_PREFIX = "restaurantai.coupons.";
const EVENT_NAME = "restaurantai:coupons";

export function getTenantCoupons(slug: string): Coupon[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`) ?? "[]") as Coupon[];
  } catch {
    return [];
  }
}

export function updateTenantCoupons(slug: string, updater: (coupons: Coupon[]) => Coupon[]) {
  if (typeof window === "undefined") return;
  const coupons = updater(getTenantCoupons(slug));
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify(coupons));
  } catch {
    // Preserve in-memory UI behavior if local storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, coupons } }));
}

export function useTenantCoupons(slug: string) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  useEffect(() => {
    setCoupons(getTenantCoupons(slug));
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; coupons: Coupon[] }>).detail;
      if (detail?.slug === slug) setCoupons(detail.coupons);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `${STORAGE_PREFIX}${slug}`) setCoupons(getTenantCoupons(slug));
    };
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug]);
  return {
    coupons,
    update: (updater: (current: Coupon[]) => Coupon[]) => updateTenantCoupons(slug, updater),
  };
}

export function usePublicTenantCoupons(slug: string, enabled = true) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) {
      setCoupons([]);
      setError("");
      return;
    }
    let active = true;
    setCoupons([]);
    setError("");
    void api
      .publicCoupons(slug)
      .then((items) => {
        if (active) setCoupons(items);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar os cupons.");
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, slug]);
  return { coupons, error };
}

export type CouponValidation = {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  error?: string;
};

export function validateCoupon(
  coupons: Coupon[],
  rawCode: string,
  subtotal: number,
  deliveryFee: number,
  isDelivery: boolean,
  now = new Date(),
): CouponValidation {
  const code = rawCode.trim().toLocaleUpperCase("pt-BR");
  if (!code) return { valid: false, discountAmount: 0 };
  const coupon = coupons.find((item) => item.code.toLocaleUpperCase("pt-BR") === code);
  if (!coupon || !coupon.active)
    return { valid: false, discountAmount: 0, error: "Cupom não encontrado ou inativo." };
  if (now < new Date(coupon.startsAt))
    return { valid: false, coupon, discountAmount: 0, error: "Este cupom ainda não está válido." };
  if (now > new Date(coupon.expiresAt))
    return { valid: false, coupon, discountAmount: 0, error: "Este cupom expirou." };
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      error: "Este cupom atingiu o limite de utilizações.",
    };
  if (coupon.kind === "frete-gratis" && !isDelivery)
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      error: "Frete grátis é válido apenas para pedidos de entrega.",
    };
  if (coupon.kind === "frete-gratis" && deliveryFee <= 0)
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      error: "A taxa de entrega ainda não está configurada para este cardápio.",
    };
  const discountAmount =
    coupon.kind === "percentual"
      ? Math.min(subtotal, (subtotal * Math.min(100, Math.max(0, coupon.value))) / 100)
      : coupon.kind === "valor-fixo"
        ? Math.min(subtotal, Math.max(0, coupon.value))
        : Math.max(0, deliveryFee);
  return { valid: true, coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
}
