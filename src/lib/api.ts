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
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Não foi possível falar com o servidor local (backend offline)", 0);
  }

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

export type ApiUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
};

export type ApiRestaurant = {
  id: number;
  name: string;
  slug: string;
  whatsappInstance: string;
  aiInstructions: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  kind: string | null;
  openingHours: string | null;
  isOpen: boolean;
};

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

export type ApiTable = {
  id: number;
  label: string;
  seats: number;
  isActive: boolean;
  sessionId: number | null;
  sessionOpenedAt: string | null;
  sessionTotal: number;
  sessionOrders: number;
};

export type ApiOrderItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
};

export type ApiOrder = {
  id: number;
  tableId: number | null;
  sessionId: number | null;
  source: string;
  customerName: string | null;
  customerPhone: string | null;
  orderDetails: string;
  itemsJson: ApiOrderItem[] | null;
  total: string;
  notes: string | null;
  status: "PENDENTE" | "PREPARANDO" | "ENTREGUE" | "CANCELADO";
  createdAt: string;
};

export type ApiSession = {
  sessionId: number;
  tableId: number;
  tableLabel: string;
  openedAt: string;
  total: number;
  orders: ApiOrder[];
};

export type PaymentMethod = "dinheiro" | "pix" | "cartao" | "outros";

export type PublicMenuResponse = {
  restaurant: Pick<
    ApiRestaurant,
    "id" | "name" | "slug" | "description" | "phone" | "whatsapp" | "address" | "city" | "state" | "openingHours" | "isOpen"
  >;
  menu: { id: number; name: string; slug: string } | null;
  products: ApiProduct[];
  tables: { id: number; label: string }[];
};

export type AuthResponse = {
  token: string;
  user: ApiUser;
  restaurant: ApiRestaurant;
};

/* ---------- Endpoints ---------- */

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (input: {
    restaurantName: string;
    email: string;
    password: string;
    ownerName?: string;
    phone?: string;
    whatsapp?: string;
    kind?: string;
    address?: string;
    city?: string;
    state?: string;
    whatsappInstance?: string;
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<{ user: ApiUser; restaurantId: number }>("/auth/me"),

  /* restaurante */
  getRestaurant: () => request<ApiRestaurant>("/me/restaurant"),
  updateRestaurant: (input: Partial<ApiRestaurant>) =>
    request<ApiRestaurant>("/me/restaurant", { method: "PATCH", body: JSON.stringify(input) }),

  /* cardápios */
  listMenus: () => request<ApiMenu[]>("/me/menus"),
  createMenu: (input: { name: string; slug?: string; aiInstructions?: string; isActive?: boolean }) =>
    request<ApiMenu>("/me/menus", { method: "POST", body: JSON.stringify(input) }),
  updateMenu: (
    id: number,
    input: { name?: string; slug?: string; aiInstructions?: string; isActive?: boolean },
  ) => request<ApiMenu>(`/me/menus/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteMenu: (id: number) => request<void>(`/me/menus/${id}`, { method: "DELETE" }),

  /* produtos */
  listProducts: (menuId?: number) =>
    request<ApiProduct[]>(`/me/products${menuId ? `?menuId=${menuId}` : ""}`),
  createProduct: (input: ProductPayload) =>
    request<ApiProduct>("/me/products", { method: "POST", body: JSON.stringify(input) }),
  updateProduct: (id: number, input: Partial<ProductPayload>) =>
    request<ApiProduct>(`/me/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProduct: (id: number) => request<void>(`/me/products/${id}`, { method: "DELETE" }),

  /* mesas */
  listTables: () => request<ApiTable[]>("/me/tables"),
  createTable: (input: { label: string; seats?: number }) =>
    request<ApiTable>("/me/tables", { method: "POST", body: JSON.stringify(input) }),
  updateTable: (id: number, input: { label?: string; seats?: number; isActive?: boolean }) =>
    request<ApiTable>(`/me/tables/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteTable: (id: number) => request<void>(`/me/tables/${id}`, { method: "DELETE" }),
  openTable: (id: number) => request<{ id: number }>(`/me/tables/${id}/open`, { method: "POST" }),

  /* pedidos / cozinha / delivery */
  listOrders: (status?: ApiOrder["status"]) =>
    request<ApiOrder[]>(`/me/orders${status ? `?status=${status}` : ""}`),
  updateOrderStatus: (id: number, status: ApiOrder["status"]) =>
    request<ApiOrder>(`/me/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  /* caixa */
  listOpenSessions: () => request<ApiSession[]>("/me/cashier/sessions"),
  closeSession: (sessionId: number, paymentMethod: PaymentMethod) =>
    request<{ id: number }>(`/me/cashier/sessions/${sessionId}/close`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod }),
    }),

  /* equipe */
  listUsers: () => request<ApiUser[]>("/me/users"),
  createUser: (input: { name: string; email: string; password: string; role: string }) =>
    request<ApiUser>("/me/users", { method: "POST", body: JSON.stringify(input) }),
  updateUser: (id: number, input: { name?: string; role?: string; isActive?: boolean }) =>
    request<ApiUser>(`/me/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteUser: (id: number) => request<void>(`/me/users/${id}`, { method: "DELETE" }),

  /* super admin */
  adminMetrics: () =>
    request<{
      restaurants: number;
      users: number;
      products: number;
      conversations: number;
      orders: number;
      revenue: number;
    }>("/admin/metrics"),
  adminRestaurants: () =>
    request<
      {
        id: number;
        name: string;
        slug: string;
        city: string | null;
        state: string | null;
        isOpen: boolean;
        whatsappInstance: string;
        userCount: number;
        orderCount: number;
        revenue: number;
      }[]
    >("/admin/restaurants"),

  /* público (QR Code da mesa) */
  publicMenu: (slug: string, menuSlug?: string) =>
    request<PublicMenuResponse>(
      `/public/restaurants/${slug}${menuSlug ? `?menu=${menuSlug}` : ""}`,
    ),
  publicOrder: (
    slug: string,
    input: {
      tableLabel?: string;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
      items: ApiOrderItem[];
    },
  ) =>
    request<{ order: ApiOrder; total: number }>(`/public/restaurants/${slug}/orders`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function brl(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
