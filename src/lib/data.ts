/**
 * Camada de dados do painel. Sessões reais usam exclusivamente o backend; dados locais
 * são usados apenas quando não existe um token de autenticação (modo demonstração).
 */
import {
  api,
  ApiError,
  getToken,
  slugify,
  type ApiMenu,
  type ApiOrder,
  type ApiOrderItem,
  type ApiProduct,
  type ApiPublicOrderTracking,
  type ApiSession,
  type ApiTable,
  type ApiUser,
  type PaymentMethod,
  type ProductPayload,
  type PublicMenuResponse,
} from "./api";
import { defaultPrompt, menu as seedMenu } from "./mock";

const DEMO_KEY = "restauranteai.demo";

type Session = { id: number; tableId: number; openedAt: string; closedAt: string | null; payment: PaymentMethod | null };
type Demo = {
  seq: number;
  restaurant: { name: string; slug: string };
  menus: ApiMenu[];
  products: ApiProduct[];
  tables: { id: number; label: string; seats: number; isActive: boolean }[];
  sessions: Session[];
  orders: ApiOrder[];
  users: ApiUser[];
};

function seed(): Demo {
  const now = new Date().toISOString();
  const menuId = 1;
  return {
    seq: 100,
    restaurant: { name: "Pizzaria Vulcão", slug: "pizzaria-vulcao" },
    menus: [
      { id: menuId, restaurantId: 1, name: "Cardápio principal", slug: "principal", aiInstructions: defaultPrompt, isActive: true, createdAt: now },
    ],
    products: seedMenu.map((m, i) => ({
      id: i + 1,
      restaurantId: 1,
      menuId,
      name: m.name,
      description: m.description,
      price: m.price.toFixed(2),
      category: m.category,
      imageUrl: m.imageUrl ?? null,
      status: m.available ? "DISPONIVEL" : "INDISPONIVEL",
    })),
    tables: [1, 2, 3, 4, 5, 6].map((n) => ({ id: n, label: `Mesa ${n}`, seats: 4, isActive: true })),
    sessions: [],
    orders: [],
    users: [{ id: 1, name: "Marco Silva", email: "marco@pizzariavulcao.com.br", role: "OWNER", isActive: true, createdAt: now }],
  };
}

function load(): Demo {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as Demo;
  } catch {
    /* ignore */
  }
  const d = seed();
  save(d);
  return d;
}
function save(d: Demo) {
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(d));
}
function mutate<T>(fn: (d: Demo) => T): T {
  const d = load();
  const r = fn(d);
  save(d);
  return r;
}
const nextId = (d: Demo) => ++d.seq;

export function setDemoRestaurant(name: string) {
  mutate((d) => {
    d.restaurant = { name, slug: slugify(name) || "meu-restaurante" };
  });
}

export function isDemo() {
  return !getToken();
}

async function call<T>(real: () => Promise<T>, demo: () => T): Promise<T> {
  if (getToken()) {
    return real();
  }
  return demo();
}

function openSession(d: Demo, tableId: number) {
  let s = d.sessions.find((x) => x.tableId === tableId && !x.closedAt);
  if (!s) {
    s = { id: nextId(d), tableId, openedAt: new Date().toISOString(), closedAt: null, payment: null };
    d.sessions.push(s);
  }
  return s;
}

function makeOrder(
  d: Demo,
  input: { tableId?: number | null; source: string; customerName?: string; customerPhone?: string; notes?: string; items: ApiOrderItem[] },
): ApiOrder & { trackingToken: string } {
  const total = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const session = input.tableId ? openSession(d, input.tableId) : null;
  const order: ApiOrder = {
    id: nextId(d),
    tableId: input.tableId ?? null,
    sessionId: session?.id ?? null,
    source: input.source,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    orderDetails: input.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
    itemsJson: input.items,
    total: total.toFixed(2),
    notes: input.notes ?? null,
    status: "PENDENTE",
    createdAt: new Date().toISOString(),
    trackingToken: globalThis.crypto.randomUUID(),
  };
  d.orders.unshift(order);
  return order;
}

export const data = {
  /* cardápios */
  listMenus: () =>
    call(api.listMenus, () => {
      const d = load();
      return d.menus.map((m) => ({ ...m, productCount: d.products.filter((p) => p.menuId === m.id).length }));
    }),
  createMenu: (input: { name: string; aiInstructions?: string; isActive?: boolean }) =>
    call(
      () => api.createMenu(input),
      () =>
        mutate((d) => {
          if (input.isActive) d.menus.forEach((m) => (m.isActive = false));
          const m: ApiMenu = {
            id: nextId(d),
            restaurantId: 1,
            name: input.name,
            slug: slugify(input.name) || `cardapio-${d.seq}`,
            aiInstructions: input.aiInstructions ?? null,
            isActive: !!input.isActive || d.menus.length === 0,
            createdAt: new Date().toISOString(),
          };
          d.menus.push(m);
          return m;
        }),
    ),
  updateMenu: (id: number, input: { name?: string; aiInstructions?: string; isActive?: boolean }) =>
    call(
      () => api.updateMenu(id, input),
      () =>
        mutate((d) => {
          if (input.isActive) d.menus.forEach((m) => (m.isActive = false));
          const m = d.menus.find((x) => x.id === id);
          if (!m) throw new Error("Registro não encontrado");
          Object.assign(m, input);
          if (input.name) m.slug = slugify(input.name);
          return m;
        }),
    ),
  deleteMenu: (id: number) =>
    call(
      () => api.deleteMenu(id),
      () =>
        mutate((d) => {
          const wasActive = d.menus.find((m) => m.id === id)?.isActive;
          d.menus = d.menus.filter((m) => m.id !== id);
          d.products = d.products.filter((p) => p.menuId !== id);
          if (wasActive && d.menus[0]) d.menus[0].isActive = true;
        }),
    ),

  /* produtos */
  listProducts: (menuId?: number) =>
    call(
      () => api.listProducts(menuId),
      () => load().products.filter((p) => !menuId || p.menuId === menuId),
    ),
  createProduct: (input: ProductPayload) =>
    call(
      () => api.createProduct(input),
      () =>
        mutate((d) => {
          const p: ApiProduct = {
            id: nextId(d),
            restaurantId: 1,
            menuId: input.menuId ?? d.menus.find((m) => m.isActive)?.id ?? null,
            name: input.name,
            description: input.description ?? null,
            price: input.price.toFixed(2),
            category: input.category ?? null,
            imageUrl: input.imageUrl ?? null,
            status: input.status ?? "DISPONIVEL",
          };
          d.products.push(p);
          return p;
        }),
    ),
  updateProduct: (id: number, input: Partial<ProductPayload>) =>
    call(
      () => api.updateProduct(id, input),
      () =>
        mutate((d) => {
          const p = d.products.find((x) => x.id === id);
          if (!p) throw new Error("Registro não encontrado");
          const { price, ...rest } = input;
          Object.assign(p, rest);
          if (price !== undefined) p.price = price.toFixed(2);
          return p;
        }),
    ),
  uploadProductImage: (id: number, image: string) => api.uploadProductImage(id, image),
  deleteProductImage: (id: number) => api.deleteProductImage(id),
  deleteProduct: (id: number) =>
    call(
      () => api.deleteProduct(id),
      () =>
        mutate((d) => {
          d.products = d.products.filter((p) => p.id !== id);
        }),
    ),

  /* mesas */
  listTables: () =>
    call(api.listTables, (): ApiTable[] => {
      const d = load();
      return d.tables.map((t) => {
        const s = d.sessions.find((x) => x.tableId === t.id && !x.closedAt);
        const os = s ? d.orders.filter((o) => o.sessionId === s.id && o.status !== "CANCELADO") : [];
        return {
          ...t,
          sessionId: s?.id ?? null,
          sessionOpenedAt: s?.openedAt ?? null,
          sessionTotal: os.reduce((a, o) => a + Number(o.total), 0),
          sessionOrders: os.length,
        };
      });
    }),
  createTable: (input: { label: string; seats?: number }) =>
    call(
      () => api.createTable(input),
      () =>
        mutate((d) => {
          const t = { id: nextId(d), label: input.label, seats: input.seats ?? 4, isActive: true };
          d.tables.push(t);
          return t;
        }),
    ),
  updateTable: (id: number, input: { label?: string; seats?: number; isActive?: boolean }) =>
    call(
      () => api.updateTable(id, input),
      () =>
        mutate((d) => {
          const table = d.tables.find((t) => t.id === id);
          if (!table) throw new Error("Mesa não encontrada");
          Object.assign(table, input);
          return { ...table, sessionId: null, sessionOpenedAt: null, sessionTotal: 0, sessionOrders: 0 };
        }),
    ),
  deleteTable: (id: number) =>
    call(
      () => api.deleteTable(id),
      () =>
        mutate((d) => {
          d.tables = d.tables.filter((t) => t.id !== id);
        }),
    ),
  openTable: (id: number) =>
    call(
      () => api.openTable(id),
      () => mutate((d) => ({ id: openSession(d, id).id })),
    ),

  /* pedidos */
  listOrders: () => call(() => api.listOrders(), () => load().orders),
  updateOrderStatus: (id: number, status: ApiOrder["status"]) =>
    call(
      () => api.updateOrderStatus(id, status),
      () =>
        mutate((d) => {
          const o = d.orders.find((x) => x.id === id);
          if (!o) throw new Error("Registro não encontrado");
          o.status = status;
          return o;
        }),
    ),
  /** PDV / Delivery: pedido lançado pelo painel. */
  createOrder: async (input: {
    tableId?: number | null;
    tableLabel?: string;
    source: "pdv" | "delivery" | "balcao";
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    items: ApiOrderItem[];
  }) => {
    if (getToken()) {
      try {
        const slug = (await api.getRestaurant()).slug;
        const r = await api.publicOrder(slug, {
          tableLabel: input.tableLabel,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          notes: input.notes,
          items: input.items,
        });
        return r.order;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 0)) throw e;
      }
    }
    return mutate((d) => makeOrder(d, input));
  },

  /* caixa */
  listOpenSessions: () =>
    call(api.listOpenSessions, (): ApiSession[] => {
      const d = load();
      return d.sessions
        .filter((s) => !s.closedAt)
        .map((s) => {
          const orders = d.orders.filter((o) => o.sessionId === s.id && o.status !== "CANCELADO");
          return {
            sessionId: s.id,
            tableId: s.tableId,
            tableLabel: d.tables.find((t) => t.id === s.tableId)?.label ?? "Mesa",
            openedAt: s.openedAt,
            total: orders.reduce((a, o) => a + Number(o.total), 0),
            orders,
          };
        });
    }),
  closeSession: (sessionId: number, payment: PaymentMethod) =>
    call(
      () => api.closeSession(sessionId, payment),
      () =>
        mutate((d) => {
          const s = d.sessions.find((x) => x.id === sessionId);
          if (!s) throw new Error("Registro não encontrado");
          s.closedAt = new Date().toISOString();
          s.payment = payment;
          d.orders.forEach((o) => {
            if (o.sessionId === sessionId && o.status !== "CANCELADO") o.status = "ENTREGUE";
          });
          return { id: sessionId };
        }),
    ),

  /* equipe */
  listUsers: () => call(api.listUsers, () => load().users),
  createUser: (input: { name: string; email: string; password: string; role: string }) =>
    call(
      () => api.createUser(input),
      () =>
        mutate((d) => {
          const u: ApiUser = { id: nextId(d), name: input.name, email: input.email, role: input.role, isActive: true, createdAt: new Date().toISOString() };
          d.users.push(u);
          return u;
        }),
    ),
  updateUser: (id: number, input: { name?: string; role?: string; isActive?: boolean }) =>
    call(
      () => api.updateUser(id, input),
      () =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === id);
          if (!u) throw new Error("Registro não encontrado");
          Object.assign(u, input);
          return u;
        }),
    ),
  deleteUser: (id: number) =>
    call(
      () => api.deleteUser(id),
      () =>
        mutate((d) => {
          d.users = d.users.filter((u) => u.id !== id);
        }),
    ),

  /* super admin */
  adminOverview: () =>
    call(
      async () => ({ metrics: await api.adminMetrics(), restaurants: await api.adminRestaurants() }),
      () => {
        const d = load();
        const revenue = d.orders.filter((o) => o.status !== "CANCELADO").reduce((a, o) => a + Number(o.total), 0);
        return {
          metrics: { restaurants: 1, users: d.users.length, products: d.products.length, conversations: 4, orders: d.orders.length, revenue },
          restaurants: [
            { id: 1, name: d.restaurant.name, slug: d.restaurant.slug, city: "São Paulo", state: "SP", isOpen: true, whatsappInstance: "vulcao-01", userCount: d.users.length, orderCount: d.orders.length, revenue },
          ],
        };
      },
    ),

  /* público */
  restaurantSlug: () => call(async () => (await api.getRestaurant()).slug, () => load().restaurant.slug),
  publicMenu: async (slug: string, menuSlug?: string): Promise<PublicMenuResponse> => {
    try {
      return await api.publicMenu(slug, menuSlug);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e;
    }
    const d = load();
    const menu = d.menus.find((m) => (menuSlug ? m.slug === menuSlug : m.isActive)) ?? d.menus[0] ?? null;
    return {
      restaurant: { id: 1, name: d.restaurant.name, slug: d.restaurant.slug, description: "Pizzas artesanais no forno a lenha", logoUrl: null, coverUrl: null, primaryColor: "#128c45", faviconUrl: null, publicPolicy: null, phone: null, whatsapp: null, address: null, city: null, state: null, openingHours: "18h às 23h", isOpen: true },
      menu: menu ? { id: menu.id, name: menu.name, slug: menu.slug } : null,
      products: d.products.filter((p) => p.menuId === menu?.id && p.status === "DISPONIVEL"),
      promotions: [],
      tables: d.tables.filter((t) => t.isActive).map((t) => ({ id: t.id, label: t.label })),
    };
  },
  publicOrder: async (
    slug: string,
    input: { tableLabel?: string; customerName?: string; customerPhone?: string; notes?: string; items: ApiOrderItem[] },
  ) => {
    try {
      const result = await api.publicOrder(slug, input);
      return { trackingToken: result.trackingToken };
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e;
    }
    return mutate((d) => {
      const table = d.tables.find((t) => t.label === input.tableLabel);
      const order = makeOrder(d, { ...input, tableId: table?.id ?? null, source: table ? "qrcode" : "delivery" });
      return { trackingToken: order.trackingToken };
    });
  },
  publicOrderStatus: async (trackingToken: string): Promise<ApiPublicOrderTracking> => {
    try {
      return await api.publicOrderStatus(trackingToken);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e;
    }
    const d = load();
    const order = d.orders.find((candidate) => candidate.trackingToken === trackingToken);
    if (!order) throw new Error("Não foi possível localizar este pedido.");
    return {
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      restaurantName: d.restaurant.name,
      tableLabel: d.tables.find((table) => table.id === order.tableId)?.label ?? null,
    };
  },
};

export const statusLabel: Record<ApiOrder["status"], string> = {
  PENDENTE: "Novo",
  PREPARANDO: "Preparando",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const roleLabel: Record<string, string> = {
  owner: "Proprietário",
  gerente: "Gerente",
  atendente: "Atendimento",
  cozinha: "Cozinha",
  caixa: "Caixa",
  motoboy: "Motoboy",
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  GARCOM: "Garçom",
  COZINHA: "Cozinha",
  CAIXA: "Caixa",
  ENTREGADOR: "Entregador",
  SUPER_ADMIN: "Super admin",
};
