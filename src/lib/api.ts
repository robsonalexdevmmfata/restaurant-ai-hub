/** Cliente do backend Fastify (backend/) que fala com o PostgreSQL local. */

export const API_URL =
  (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001";

const TOKEN_KEY = "restauranteai.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new ApiError(
      (payload['error'] as string) ?? `Erro ${response.status}`,
      response.status,
    );
  }

  return payload as T;
}

/* ---------- Tipos ---------- */

export type ApiMenu = {
  id: number;
  restaurantId: number;
  name: string;
  slug: string;
  aiInstructions: string | null;
  isActive: boolean;
  createdAt: string;
  productCount?: number;
};

export type ApiProduct = {
  id: number;
  restaurantId: number;
  menuId: number | null;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  status: "DISPONIVEL" | "INDISPONIVEL";
};

export type ProductPayload = {
  menuId?: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  status?: "DISPONIVEL" | "INDISPONIVEL";
};

/* ---------- Endpoints ---------- */

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { email: string }; restaurant: { name: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),

  register: (input: {
    restaurantName: string;
    whatsappInstance: string;
    email: string;
    password: string;
  }) =>
    request<{ token: string; user: { email: string }; restaurant: { name: string } }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(input) },
    ),

  listMenus: () => request<ApiMenu[]>("/me/menus"),

  createMenu: (input: { name: string; slug?: string; aiInstructions?: string; isActive?: boolean }) =>
    request<ApiMenu>("/me/menus", { method: "POST", body: JSON.stringify(input) }),

  updateMenu: (
    id: number,
    input: { name?: string; slug?: string; aiInstructions?: string; isActive?: boolean },
  ) => request<ApiMenu>(`/me/menus/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteMenu: (id: number) => request<void>(`/me/menus/${id}`, { method: "DELETE" }),

  listProducts: (menuId?: number) =>
    request<ApiProduct[]>(`/me/products${menuId ? `?menuId=${menuId}` : ""}`),

  createProduct: (input: ProductPayload) =>
    request<ApiProduct>("/me/products", { method: "POST", body: JSON.stringify(input) }),

  updateProduct: (id: number, input: Partial<ProductPayload>) =>
    request<ApiProduct>(`/me/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteProduct: (id: number) => request<void>(`/me/products/${id}`, { method: "DELETE" }),
};

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
