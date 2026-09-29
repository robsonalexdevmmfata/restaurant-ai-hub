import { useEffect, useState } from "react";

import { menu, type MenuItem } from "@/lib/mock";

const STORAGE_PREFIX = "restaurantai.menu.";
const CATEGORY_PREFIX = "restaurantai.menu-categories.";
const EVENT_NAME = "restaurantai:menu";

export function getTenantMenu(slug: string): MenuItem[] {
  if (typeof window === "undefined") return menu;
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    if (saved) return JSON.parse(saved) as MenuItem[];
  } catch {
    // Use the built-in demo catalog if browser storage is unavailable.
  }
  return menu;
}

export function updateTenantMenu(slug: string, updater: (items: MenuItem[]) => MenuItem[]) {
  if (typeof window === "undefined") return;
  const items = updater(getTenantMenu(slug));
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify(items));
  } catch {
    // Keep this tab responsive if local storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, items } }));
}

export function getTenantMenuCategories(slug: string) {
  if (typeof window === "undefined") return [...new Set(menu.map((item) => item.category))];
  try {
    const saved = window.localStorage.getItem(`${CATEGORY_PREFIX}${slug}`);
    if (saved) return JSON.parse(saved) as string[];
  } catch {
    // Fall back to categories represented by the current menu data.
  }
  return [...new Set(getTenantMenu(slug).map((item) => item.category))];
}

export function updateTenantMenuCategories(slug: string, categories: string[]) {
  if (typeof window === "undefined") return;
  const uniqueCategories = [...new Set(categories.map((category) => category.trim()).filter(Boolean))];
  try {
    window.localStorage.setItem(`${CATEGORY_PREFIX}${slug}`, JSON.stringify(uniqueCategories));
  } catch {
    // Keep the active editor usable if browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, categories: uniqueCategories } }));
}

export function useTenantMenu(slug: string) {
  const [items, setItems] = useState<MenuItem[]>(menu);
  const [categories, setCategories] = useState<string[]>(() => [...new Set(menu.map((item) => item.category))]);

  useEffect(() => {
    setItems(getTenantMenu(slug));
    setCategories(getTenantMenuCategories(slug));
    const handleMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; items?: MenuItem[]; categories?: string[] }>).detail;
      if (detail?.slug !== slug) return;
      if (detail.items) setItems(detail.items);
      if (detail.categories) setCategories(detail.categories);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `${STORAGE_PREFIX}${slug}`) setItems(getTenantMenu(slug));
      if (event.key === `${CATEGORY_PREFIX}${slug}`) setCategories(getTenantMenuCategories(slug));
    };
    window.addEventListener(EVENT_NAME, handleMenu);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleMenu);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug]);

  return {
    items,
    update: (updater: (current: MenuItem[]) => MenuItem[]) => updateTenantMenu(slug, updater),
    categories,
    updateCategories: (next: string[]) => updateTenantMenuCategories(slug, next),
  };
}
