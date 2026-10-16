import { sql } from "drizzle-orm";
import {
  pgTable,
  customType,
  serial,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  subscriptionPlan: varchar("subscription_plan", { length: 30 }).notNull().default("Essencial"),
  subscriptionStatus: varchar("subscription_status", { length: 30 }).notNull().default("simulado"),
  whatsappInstance: varchar("whatsapp_instance", { length: 255 }).notNull().unique(),
  aiInstructions: text("ai_instructions"),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#128c45"),
  faviconUrl: text("favicon_url"),
  webhookUrl: text("webhook_url"),
  publicPolicy: text("public_policy"),
  cnpj: varchar("cnpj", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 60 }),
  kind: varchar("kind", { length: 60 }),
  openingHours: text("opening_hours"),
  isOpen: boolean("is_open").notNull().default(true),
});

export const diningTables = pgTable(
  "dining_tables",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableNumber: integer("table_number").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Livre"),
    sessionId: varchar("session_id", { length: 64 }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantTableUnique: uniqueIndex("dining_tables_restaurant_table_unique").on(
      table.restaurantId,
      table.tableNumber,
    ),
  }),
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("owner"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export const menus = pgTable(
  "menus",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    aiInstructions: text("ai_instructions"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantSlug: unique("menus_restaurant_slug_key").on(table.restaurantId, table.slug),
  }),
);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  menuId: integer("menu_id").references(() => menus.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  imageUrl: text("image_url"),
  status: varchar("status", { length: 50 }).notNull().default("DISPONIVEL"),
});

export const productImages = pgTable("product_images", {
  productId: integer("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const restaurantImages = pgTable("restaurant_images", {
  restaurantId: integer("restaurant_id")
    .primaryKey()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const restaurantAssets = pgTable("restaurant_assets", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 20 }).notNull(),
  title: varchar("title", { length: 120 }),
  description: varchar("description", { length: 280 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 60 }).notNull(),
    seats: integer("seats").notNull().default(4),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantLabel: unique("restaurant_tables_restaurant_label_key").on(
      table.restaurantId,
      table.label,
    ),
  }),
);

export const tableSessions = pgTable("table_sessions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  tableId: integer("table_id")
    .notNull()
    .references(() => restaurantTables.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("ABERTA"),
  paymentMethod: varchar("payment_method", { length: 30 }),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  openedAt: timestamp("opened_at", { withTimezone: false }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: false }),
  closeRequestedAt: timestamp("close_requested_at", { withTimezone: false }),
});

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: integer("table_id").references(() => restaurantTables.id, { onDelete: "set null" }),
    sessionId: integer("session_id").references(() => tableSessions.id, { onDelete: "set null" }),
    source: varchar("source", { length: 20 }).notNull().default("ia"),
    customerName: varchar("customer_name", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 30 }),
    orderDetails: text("order_details").notNull(),
    itemsJson: jsonb("items_json"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    couponCode: varchar("coupon_code", { length: 80 }),
    couponDiscount: numeric("coupon_discount", { precision: 10, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    paymentMethod: varchar("payment_method", { length: 30 }),
    deliveryAddress: text("delivery_address"),
    deliveryNeighborhood: varchar("delivery_neighborhood", { length: 120 }),
    deliveryPostalCode: varchar("delivery_postal_code", { length: 12 }),
    status: varchar("status", { length: 50 }).notNull().default("PENDENTE"),
    trackingToken: varchar("tracking_token", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    trackingTokenUnique: uniqueIndex("orders_tracking_token_unique").on(table.trackingToken),
  }),
);

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxUses: integer("max_uses").notNull().default(0),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantCodeUnique: uniqueIndex("coupons_restaurant_code_unique").on(
      table.restaurantId,
      table.code,
    ),
  }),
);

export const deliveryAssignments = pgTable("delivery_assignments", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("DISPONIVEL"),
  assignedAt: timestamp("assigned_at", { withTimezone: false }),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: false }),
});

export const deliveryAssignmentHistory = pgTable("delivery_assignment_history", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  driverId: integer("driver_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: false }).notNull().defaultNow(),
});

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    previousStatus: varchar("previous_status", { length: 50 }),
    newStatus: varchar("new_status", { length: 50 }).notNull(),
    operatorId: integer("operator_id"),
    operatorLabel: varchar("operator_label", { length: 255 }),
    source: varchar("source", { length: 40 }).notNull(),
    reason: text("reason"),
    changedAt: timestamp("changed_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    orderChangedAt: index("order_status_history_order_changed_at_idx").on(
      table.orderId,
      table.changedAt,
      table.id,
    ),
  }),
);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  customerPhone: varchar("customer_phone", { length: 30 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("ia"),
  cartJson: jsonb("cart_json"),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    externalMessageId: varchar("external_message_id", { length: 255 }).unique(),
    replyToMessageId: integer("reply_to_message_id").references((): AnyPgColumn => conversationMessages.id, {
      onDelete: "cascade",
    }),
    deliveryStatus: varchar("delivery_status", { length: 20 }).notNull().default("sent"),
    deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationCreatedAt: index("conversation_messages_history_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    conversationReplyUnique: uniqueIndex("conversation_messages_reply_to_unique")
      .on(table.replyToMessageId)
      .where(sql`${table.replyToMessageId} IS NOT NULL`),
  }),
);

export type Restaurant = typeof restaurants.$inferSelect;
export type DiningTable = typeof diningTables.$inferSelect;
export type User = typeof users.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type RestaurantAsset = typeof restaurantAssets.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
