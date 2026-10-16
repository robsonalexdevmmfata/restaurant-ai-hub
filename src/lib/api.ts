/** Cliente do backend Fastify (backend/) que fala com o PostgreSQL local. */

export const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ??
  import.meta.env["VITE_API_BASE_URL"]?.replace(/\/$/, "") ??
  "http://localhost:3001";

export function apiAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:"))
    return path;
  if (path.startsWith("/demo-assets/")) return path;
  return `${API_URL}/api${path.startsWith("/") ? path : `/${path}`}`;
}

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
    throw new ApiError((payload["error"] as string) ?? `Erro ${response.status}`, response.status);
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
  createdAt?: string | undefined;
};

export type ApiRestaurant = {
  id: number;
  name: string;
  slug: string;
  subscriptionPlan: "Essencial" | "Profissional" | "Enterprise";
  subscriptionStatus: "simulado" | "ativo" | "suspenso";
  whatsappInstance: string;
  aiInstructions: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  faviconUrl: string | null;
  webhookUrl: string | null;
  publicPolicy: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  kind: string | null;
  openingHours: string | null;
  isOpen: boolean;
};

export type ApiAiIntegrationStatus = {
  evolutionConnectionState: string;
  evolutionInstanceConnected: boolean;
};

export type ApiEvolutionInstanceResult = {
  instance: string;
  state: string;
  qrCode: string | null;
  created: boolean;
  webhookConfigured: boolean;
};

export type ApiMenu = {
  id: number;
  restaurantId: number;
  name: string;
  slug: string;
  aiInstructions: string | null;
  isActive: boolean;
  createdAt: string;
  productCount?: number | undefined;
};

export type ApiProduct = {
  id: number;
  restaurantId: number;
  menuId: number | null;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  imageUrl: string | null;
  status: "DISPONIVEL" | "INDISPONIVEL";
};

export type ProductPayload = {
  menuId?: number | undefined;
  name: string;
  description?: string | undefined;
  price: number;
  category?: string | undefined;
  imageUrl?: string | null | undefined;
  status?: "DISPONIVEL" | "INDISPONIVEL" | undefined;
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
  notes?: string | undefined;
};

export type ApiOrder = {
  id: number;
  tableId: number | null;
  sessionId: number | null;
  source: string;
  tableLabel?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  orderDetails: string;
  itemsJson: ApiOrderItem[] | null;
  total: string;
  couponCode?: string | null;
  couponDiscount?: string;
  notes: string | null;
  paymentMethod?: string | null;
  deliveryAddress?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryPostalCode?: string | null;
  status: "PENDENTE" | "PREPARANDO" | "ENTREGUE" | "SAIU_PARA_ENTREGA" | "FINALIZADO" | "CANCELADO";
  createdAt: string;
  trackingToken?: string | null;
};

export type ApiPublicOrderTracking = {
  status: ApiOrder["status"];
  total: string;
  createdAt: string;
};

export type ApiOrderStatusHistory = {
  previousStatus: string | null;
  newStatus: string;
  operatorId: number | null;
  operatorLabel: string | null;
  source: string;
  reason: string | null;
  changedAt: string;
};

export type ApiSession = {
  sessionId: number;
  tableId: number;
  tableLabel: string;
  openedAt: string;
  closeRequestedAt: string | null;
  total: number;
  orders: ApiOrder[];
};

export type PaymentMethod = "dinheiro" | "pix" | "cartao" | "outros";

export type ApiDelivery = {
  order: ApiOrder;
  assignment: {
    orderId: number;
    restaurantId: number;
    driverId: number | null;
    status: "DISPONIVEL" | "EM_ROTA" | "ENTREGUE";
    assignedAt: string | null;
    updatedAt: string;
    deliveredAt: string | null;
  };
  driverName: string | null;
};

export type PublicMenuResponse = {
  restaurant: Pick<
    ApiRestaurant,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "logoUrl"
    | "coverUrl"
    | "primaryColor"
    | "faviconUrl"
    | "phone"
    | "whatsapp"
    | "address"
    | "city"
    | "state"
    | "openingHours"
    | "publicPolicy"
    | "isOpen"
  >;
  menu: { id: number; name: string; slug: string } | null;
  products: ApiProduct[];
  promotions: ApiPromotion[];
  tables: { id: number; label: string }[];
};

export type ApiPromotion = {
  id: number;
  title: string | null;
  description: string | null;
  sortOrder: number;
  isActive?: boolean;
  imageUrl: string;
};

export type ApiCoupon = {
  id: string;
  code: string;
  kind: "percentual" | "valor-fixo" | "frete-gratis";
  value: number;
  startsAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
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
    plan: ApiRestaurant["subscriptionPlan"];
    email: string;
    password: string;
    ownerName?: string | undefined;
    phone?: string | undefined;
    whatsapp?: string | undefined;
    kind?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    whatsappInstance?: string | undefined;
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<{ user: ApiUser; restaurantId: number }>("/auth/me"),

  /* restaurante */
  getRestaurant: () => request<ApiRestaurant>("/me/restaurant"),
  getAiIntegrationStatus: () => request<ApiAiIntegrationStatus>("/me/ai/status"),
  createEvolutionInstance: (restaurantName: string) =>
    request<ApiEvolutionInstanceResult>("/me/ai/instance", {
      method: "POST",
      body: JSON.stringify({ restaurantName }),
    }),
  updateRestaurant: (input: Partial<ApiRestaurant>) =>
    request<ApiRestaurant>("/me/restaurant", { method: "PATCH", body: JSON.stringify(input) }),
  uploadRestaurantLogo: (image: string) =>
    request<{ logoUrl: string | null }>("/me/restaurant/logo", {
      method: "POST",
      body: JSON.stringify({ image }),
    }),
  deleteRestaurantLogo: () =>
    request<{ logoUrl: string | null }>("/me/restaurant/logo", { method: "DELETE" }),
  uploadRestaurantAsset: (kind: "cover" | "favicon", image: string) =>
    request<{ coverUrl?: string; faviconUrl?: string }>(`/me/restaurant/assets/${kind}`, {
      method: "POST",
      body: JSON.stringify({ image }),
    }),
  deleteRestaurantAsset: (kind: "cover" | "favicon") =>
    request<void>(`/me/restaurant/assets/${kind}`, { method: "DELETE" }),
  listPromotions: () => request<ApiPromotion[]>("/me/promotions"),
  createPromotion: (input: { title: string; description?: string; image: string }) =>
    request<{ id: number }>("/me/promotions", { method: "POST", body: JSON.stringify(input) }),
  deletePromotion: (id: number) => request<void>(`/me/promotions/${id}`, { method: "DELETE" }),
  listCoupons: () => request<ApiCoupon[]>("/me/coupons"),
  createCoupon: (
    input: Omit<ApiCoupon, "id" | "usedCount" | "active" | "createdAt"> & {
      active?: boolean;
      usedCount?: number;
    },
  ) =>
    request<ApiCoupon>("/me/coupons", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCoupon: (id: string, input: { active: boolean }) =>
    request<ApiCoupon>(`/me/coupons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  /* cardápios */
  listMenus: () => request<ApiMenu[]>("/me/menus"),
  createMenu: (input: {
    name: string;
    slug?: string;
    aiInstructions?: string;
    isActive?: boolean;
  }) => request<ApiMenu>("/me/menus", { method: "POST", body: JSON.stringify(input) }),
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
  uploadProductImage: (id: number, image: string) =>
    request<{ imageUrl: string }>(`/me/products/${id}/image`, {
      method: "POST",
      body: JSON.stringify({ image }),
    }),
  deleteProductImage: (id: number) =>
    request<void>(`/me/products/${id}/image`, { method: "DELETE" }),
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
  orderStatusHistory: (id: number) =>
    request<ApiOrderStatusHistory[]>(`/me/orders/${id}/status-history`),
  listDeliveries: () => request<ApiDelivery[]>("/me/deliveries"),
  startDelivery: (orderId: number) =>
    request<ApiDelivery["assignment"]>(`/me/deliveries/${orderId}/start`, { method: "POST" }),
  completeDelivery: (orderId: number) =>
    request<ApiDelivery["assignment"]>(`/me/deliveries/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ENTREGUE" }),
    }),
  deliveryHistory: (orderId: number) =>
    request<
      { driverId: number | null; driverName: string | null; status: string; occurredAt: string }[]
    >(`/me/deliveries/${orderId}/history`),
  listDeliveryHistory: () =>
    request<
      {
        orderId: number;
        customerName: string | null;
        customerPhone: string | null;
        deliveryAddress: string | null;
        deliveryNeighborhood: string | null;
        orderDetails: string;
        total: string;
        driverId: number | null;
        driverName: string | null;
        deliveredAt: string | null;
      }[]
    >("/me/deliveries/history"),

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
  publicCoupons: (slug: string) =>
    request<ApiCoupon[]>(`/public/restaurants/${encodeURIComponent(slug)}/coupons`),
  publicOrder: (
    slug: string,
    input: {
      tableLabel?: string | undefined;
      customerName?: string | undefined;
      customerPhone?: string | undefined;
      couponCode?: string | undefined;
      paymentMethod?: PaymentMethod | undefined;
      notes?: string | undefined;
      items: ApiOrderItem[];
    },
  ) =>
    request<{
      id: number;
      sessionId: number | null;
      total: number;
      couponCode: string | null;
      couponDiscount: number;
      trackingToken: string;
    }>(`/public/restaurants/${slug}/orders`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  publicOrderStatus: (trackingToken: string) =>
    request<ApiPublicOrderTracking>(`/public/order-tracking/${encodeURIComponent(trackingToken)}`),
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
