import { useEffect, useState } from "react";

export type KitchenOrderStatus = "Pendente" | "Em preparo" | "Pronto";
export type PaymentStatus = "Pendente" | "Pago";
export type DeliveryStatus = "Disponível" | "Em rota" | "Entregue";
export type PaymentMethod = "PIX" | "Cartão" | "Dinheiro";
export type OrderType = "Balcão" | "Salão" | "Delivery / WhatsApp";
export type DiscountType = "Percentual" | "Valor fixo";
export type DeliveryCollectionMethod = "Dinheiro" | "PIX";
export type DeliveryFeeModel = "bairro" | "quilometro" | "base-excedente";
export type NeighborhoodFee = { neighborhood: string; fee: number };
export type DeliveryFeeSettings = {
  model: DeliveryFeeModel;
  neighborhoodFees: NeighborhoodFee[];
  baseFee: number;
  perKmRate: number;
  includedKm: number;
  extraKmRate: number;
};

export const defaultDeliveryFeeSettings: DeliveryFeeSettings = {
  model: "bairro",
  neighborhoodFees: [
    { neighborhood: "Centro", fee: 5 },
    { neighborhood: "Vila Nova", fee: 7 },
    { neighborhood: "Jardim Paraíso", fee: 10 },
  ],
  baseFee: 5,
  perKmRate: 2,
  includedKm: 2,
  extraKmRate: 2,
};
export type RestaurantTableStatus = "Livre" | "Ocupada" | "Comanda Aberta" | "Aguardando Pagamento";
export type StaffActivityKind = "delivery" | "table" | "shift" | "order";

export type RestaurantTable = {
  id: number;
  status: RestaurantTableStatus;
  openedAt: string | null;
  openedBy: string | null;
  serverSessionId?: string | null | undefined;
};

export type StaffAuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  kind: StaffActivityKind;
  title: string;
  details: string;
  relatedId?: string | undefined;
  createdAt: string;
};

export type StaffActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function createStaffActivity(
  actor: StaffActor,
  activity: Omit<StaffAuditEntry, "id" | "actorId" | "actorName" | "actorEmail" | "actorRole" | "createdAt">,
): StaffAuditEntry {
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email.toLowerCase(),
    actorRole: actor.role,
    createdAt: new Date().toISOString(),
    ...activity,
  };
}

export type CashMovement = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type CashShift = {
  isOpen: boolean;
  openingFloat: number;
  withdrawals: CashMovement[];
  supplies: CashMovement[];
  received: Record<PaymentMethod, number>;
  openedAt: string | null;
  lastClosing: {
    closedAt: string;
    expectedCash: number;
    sales: number;
  } | null;
};

export type DeliveryHistoryEntry = {
  orderId: string;
  customer: string;
  neighborhood: string;
  distanceKm: number;
  fee: number;
  method: DeliveryCollectionMethod;
  orderAmountCollected?: number | undefined;
  orderPaymentMethod?: DeliveryCollectionMethod | undefined;
  completedAt: string;
};

export type WhatsAppNotificationEntry = {
  id: string;
  orderId: string;
  phone: string;
  status: "sent" | "simulated" | "failed" | "missing-phone";
  message: string;
  createdAt: string;
};

export type GeoPoint = { latitude: number; longitude: number };

export type OperationalOrder = {
  id: string;
  customer: string;
  table: string;
  address: string;
  eta: string;
  items: { name: string; qty: number; price: number }[];
  kitchenStatus: KitchenOrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | undefined;
  requestedPaymentMethod?: PaymentMethod | undefined;
  deliveryStatus: DeliveryStatus;
  orderType: OrderType;
  waitMinutes: number;
  neighborhood: string;
  distanceKm: number;
  postalCode?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  customerPhone?: string | undefined;
  driverName?: string | undefined;
  trackingToken?: string | undefined;
  routeProgress?: number | undefined;
  couponCode?: string | undefined;
  couponDiscount?: number | undefined;
  deliveryFee?: number | undefined;
  discountType?: DiscountType | undefined;
  discountValue?: number | undefined;
  discountAmount?: number | undefined;
};

export type TenantOperations = {
  revenue: number;
  paidOrderCount: number;
  deliveredCount: number;
  orders: OperationalOrder[];
  tables: RestaurantTable[];
  staffAudit: StaffAuditEntry[];
  cashShift: CashShift;
  deliveryShiftStartedAt: string | null;
  deliveryHistory: DeliveryHistoryEntry[];
  notifications: WhatsAppNotificationEntry[];
  deliveryOrigin: GeoPoint;
};

const EVENT_NAME = "restaurantai:operations";
const STORAGE_PREFIX = "restaurantai.operations.";

function createInitialOperations(): TenantOperations {
  return {
    revenue: 9640,
    paidOrderCount: 46,
    deliveredCount: 7,
    cashShift: {
      isOpen: false,
      openingFloat: 0,
      withdrawals: [],
      supplies: [],
      received: { PIX: 0, Cartão: 0, Dinheiro: 0 },
      openedAt: null,
      lastClosing: null,
    },
    deliveryShiftStartedAt: null,
    deliveryHistory: [],
    notifications: [],
    deliveryOrigin: { latitude: -23.55052, longitude: -46.633308 },
    orders: [
      {
        id: "A102",
        customer: "Carla Mendes",
        table: "Mesa 4",
        address: "Rua das Flores, 235",
        eta: "18 min",
        items: [
          { name: "Pizza Margherita", qty: 1, price: 62.9 },
          { name: "Refrigerante 1L", qty: 1, price: 8 },
          { name: "Borda catupiry", qty: 1, price: 12 },
        ],
        kitchenStatus: "Pendente",
        paymentStatus: "Pendente",
        deliveryStatus: "Disponível",
        orderType: "Salão",
        waitMinutes: 18,
        neighborhood: "Centro",
        distanceKm: 2.4,
      },
      {
        id: "A103",
        customer: "João Almeida",
        table: "Mesa 7",
        address: "Av. Brasil, 1020",
        eta: "22 min",
        items: [
          { name: "Pizza Calabresa XL", qty: 1, price: 64.5 },
          { name: "Água com gás", qty: 1, price: 8 },
        ],
        kitchenStatus: "Em preparo",
        paymentStatus: "Pendente",
        deliveryStatus: "Em rota",
        orderType: "Delivery / WhatsApp",
        waitMinutes: 23,
        neighborhood: "Vila Nova",
        distanceKm: 4.2,
      },
      {
        id: "A104",
        customer: "Renata Silva",
        table: "Mesa 2",
        address: "Praça da Liberdade, 88",
        eta: "11 min",
        items: [
          { name: "Pizza quatro queijos", qty: 1, price: 82.2 },
          { name: "Suco natural", qty: 1, price: 12 },
        ],
        kitchenStatus: "Pronto",
        paymentStatus: "Pago",
        paymentMethod: "PIX",
        deliveryStatus: "Entregue",
        orderType: "Salão",
        waitMinutes: 8,
        neighborhood: "Centro",
        distanceKm: 1.8,
      },
      {
        id: "A105",
        customer: "Pedro Costa",
        table: "Mesa 3",
        address: "Rua das Palmeiras, 54",
        eta: "25 min",
        items: [
          { name: "Pizza Vegetariana", qty: 1, price: 56.9 },
          { name: "Refrigerante 1L", qty: 1, price: 8 },
        ],
        kitchenStatus: "Em preparo",
        paymentStatus: "Pendente",
        deliveryStatus: "Disponível",
        orderType: "Delivery / WhatsApp",
        waitMinutes: 14,
        neighborhood: "Jardim Paraíso",
        distanceKm: 6.5,
      },
    ],
    tables: [
      { id: 1, status: "Livre", openedAt: null, openedBy: null },
      { id: 2, status: "Ocupada", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 3, status: "Comanda Aberta", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 4, status: "Comanda Aberta", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 5, status: "Livre", openedAt: null, openedBy: null },
      { id: 6, status: "Ocupada", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 7, status: "Comanda Aberta", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 8, status: "Livre", openedAt: null, openedBy: null },
      { id: 9, status: "Aguardando Pagamento", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 10, status: "Ocupada", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
      { id: 11, status: "Livre", openedAt: null, openedBy: null },
      { id: 12, status: "Comanda Aberta", openedAt: new Date().toISOString(), openedBy: "Demonstração" },
    ],
    staffAudit: [],
  };
}

export function getTenantOperations(slug: string): TenantOperations {
  if (typeof window === "undefined") return createInitialOperations();

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<TenantOperations>;
      const defaults = createInitialOperations();
      const defaultsById = new Map(defaults.orders.map((order) => [order.id, order]));
      const orders = (saved.orders ?? defaults.orders).map((order, index) => {
        const fallback = defaultsById.get(order.id) ?? defaults.orders[index % defaults.orders.length];
        return {
          ...fallback,
          ...order,
          orderType: order.orderType ?? fallback?.orderType ?? "Balcão",
          waitMinutes: order.waitMinutes ?? fallback?.waitMinutes ?? 0,
          neighborhood: order.neighborhood ?? fallback?.neighborhood ?? "",
          distanceKm: order.distanceKm ?? fallback?.distanceKm ?? 0,
        };
      });

      return {
        ...defaults,
        ...saved,
        cashShift: { ...defaults.cashShift, ...saved.cashShift },
        tables: saved.tables ?? defaults.tables,
        staffAudit: saved.staffAudit ?? [],
        deliveryShiftStartedAt: saved.deliveryShiftStartedAt ?? null,
        deliveryHistory: saved.deliveryHistory ?? [],
        notifications: saved.notifications ?? [],
        deliveryOrigin: saved.deliveryOrigin ?? defaults.deliveryOrigin,
        orders,
      };
    }
  } catch {
    // Fall back to the demo orders if local storage is unavailable or invalid.
  }

  return createInitialOperations();
}

export function calculateDeliveryFee(
  neighborhood: string,
  distanceKm: number,
  settings: DeliveryFeeSettings = defaultDeliveryFeeSettings,
) {
  const safeDistance = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  let fee: number;
  if (settings.model === "bairro") {
    const normalizedNeighborhood = neighborhood.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
    const rule = settings.neighborhoodFees.find((item) => item.neighborhood.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR") === normalizedNeighborhood);
    fee = rule?.fee ?? settings.baseFee;
  } else if (settings.model === "quilometro") {
    fee = settings.perKmRate * safeDistance;
  } else {
    fee = settings.baseFee + Math.max(0, safeDistance - settings.includedKm) * settings.extraKmRate;
  }
  return Math.round(Math.max(0, fee) * 100) / 100;
}

export function updateTenantOperations(
  slug: string,
  updater: (current: TenantOperations) => TenantOperations,
) {
  if (typeof window === "undefined") return;

  const operations = updater(getTenantOperations(slug));
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify(operations));
  } catch {
    // Keep the current tab functional when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, operations } }));
}

export function useTenantOperations(slug: string) {
  const [operations, setOperations] = useState(createInitialOperations);

  useEffect(() => {
    setOperations(getTenantOperations(slug));

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string; operations: TenantOperations }>).detail;
      if (detail?.slug === slug) setOperations(detail.operations);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `${STORAGE_PREFIX}${slug}`) {
        setOperations(getTenantOperations(slug));
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug]);

  return { operations, update: (updater: (current: TenantOperations) => TenantOperations) => updateTenantOperations(slug, updater) };
}
