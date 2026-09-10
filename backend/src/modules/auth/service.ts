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

export async function registerOwner(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  return db.transaction(async (tx) => {
    const [restaurant] = await tx
      .insert(restaurants)
      .values({
        name: input.restaurantName,
        whatsappInstance: input.whatsappInstance,
        aiInstructions: input.aiInstructions ?? null,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        restaurantId: restaurant.id,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "owner",
      })
      .returning({
        id: users.id,
        restaurantId: users.restaurantId,
        email: users.email,
        role: users.role,
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
