import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  whatsappInstance: varchar("whatsapp_instance", { length: 255 }).notNull().unique(),
  aiInstructions: text("ai_instructions"),
  description: text("description"),
  logoUrl: text("logo_url"),
  phone: varchar("phone", { length: 30 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 60 }),
  kind: varchar("kind", { length: 60 }),
  openingHours: text("opening_hours"),
  isOpen: boolean("is_open").notNull().default(true),
});

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
});

export const orders = pgTable("orders", {
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
  notes: text("notes"),
  status: varchar("status", { length: 50 }).notNull().default("PENDENTE"),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

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

export type Restaurant = typeof restaurants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type Product = typeof products.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
