import bcrypt from "bcryptjs";
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, closeDb } from "../src/db/index.js";
import { restaurants, users } from "../src/db/schema.js";

const EMAIL = "marco@pizzariavulcao.com";
const PASSWORD = "123456";

async function seed() {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, 1)).limit(1);
  if (!restaurant) {
    console.error("Restaurante id=1 não encontrado. Cadastre via POST /api/auth/register.");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing[0]) {
    console.log(`Usuário já existe: ${EMAIL}`);
    await closeDb();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await db.insert(users).values({
    restaurantId: restaurant.id,
    email: EMAIL,
    passwordHash,
    role: "owner",
  });

  console.log("Usuário criado com sucesso!");
  console.log(`  Email: ${EMAIL}`);
  console.log(`  Senha: ${PASSWORD}`);
  console.log(`  Restaurante: ${restaurant.name} (id=${restaurant.id})`);
  await closeDb();
}

seed().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
