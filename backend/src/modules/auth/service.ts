import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { restaurants, users } from "../../db/schema.js";
import type { RegisterInput } from "./schemas.js";

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function findUserById(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function registerOwner(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const baseSlug = slugify(input.restaurantName) || `restaurante-${Date.now()}`;
  const suffix = Math.random().toString(36).slice(2, 6);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, baseSlug))
      .limit(1);

    const slug = existing ? `${baseSlug}-${suffix}` : baseSlug;

    const [restaurant] = await tx
      .insert(restaurants)
      .values({
        name: input.restaurantName,
        slug,
        whatsappInstance: input.whatsappInstance ?? slug,
        aiInstructions: input.aiInstructions ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        kind: input.kind ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        restaurantId: restaurant.id,
        name: input.ownerName ?? null,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "owner",
      })
      .returning({
        id: users.id,
        restaurantId: users.restaurantId,
        name: users.name,
        email: users.email,
        role: users.role,
      });

    // Cardápio inicial vazio para o restaurante começar a cadastrar os pratos dele.
    await tx.insert(menus).values({
      restaurantId: restaurant.id,
      name: "Cardápio principal",
      slug: "principal",
      isActive: true,
    });

    return { user, restaurant };
  });
}

export async function verifyLogin(email: string, password: string) {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, user.restaurantId))
    .limit(1);

  return { user, restaurant: restaurant ?? null };
}
