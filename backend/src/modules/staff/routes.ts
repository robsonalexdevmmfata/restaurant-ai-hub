import bcrypt from "bcryptjs";
import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { isUniqueViolation, parseId } from "../../lib/helpers.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";

const roleSchema = z.enum(["gerente", "atendente", "cozinha", "caixa", "motoboy"]);

const createUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  role: roleSchema.default("atendente"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(128).optional(),
});

const safeColumns = {
  id: users.id,
  restaurantId: users.restaurantId,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

/** Equipe do restaurante (usuários e permissões). Somente owner/gerente podem escrever. */
export async function staffRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireJwt);

  function canManage(role: string) {
    return role === "owner" || role === "gerente";
  }

  app.get("/me/users", async (request, reply) => {
    const auth = getAuthUser(request);
    if (!canManage(auth.role)) {
      return reply.status(403).send({ error: "Sem permissão" });
    }
    return db
      .select(safeColumns)
      .from(users)
      .where(eq(users.restaurantId, auth.restaurantId))
      .orderBy(asc(users.createdAt));
  });

  app.post("/me/users", async (request, reply) => {
    const auth = getAuthUser(request);
    if (!canManage(auth.role)) return reply.status(403).send({ error: "Sem permissão" });

    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    if (auth.role === "gerente" && parsed.data.role === "gerente") {
      return reply.status(403).send({ error: "Gerentes não podem criar outros acessos de gerente" });
    }

    try {
      const [row] = await db
        .insert(users)
        .values({
          restaurantId: auth.restaurantId,
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          passwordHash: await bcrypt.hash(parsed.data.password, 10),
          role: parsed.data.role,
        })
        .returning(safeColumns);
      return reply.status(201).send(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "E-mail já cadastrado" });
      }
      throw error;
    }
  });

  app.patch("/me/users/:userId", async (request, reply) => {
    const auth = getAuthUser(request);
    if (!canManage(auth.role)) return reply.status(403).send({ error: "Sem permissão" });

    const userId = parseId((request.params as { userId: string }).userId);
    if (!userId) return reply.status(400).send({ error: "Invalid user id" });

    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.restaurantId, auth.restaurantId)))
      .limit(1);
    if (!target) return reply.status(404).send({ error: "User not found" });
    if (target.role === "owner") {
      return reply.status(409).send({ error: "O acesso do proprietário não pode ser alterado por esta tela" });
    }
    if (
      auth.role === "gerente" &&
      (target.role === "gerente" || parsed.data.role === "gerente")
    ) {
      return reply.status(403).send({ error: "Gerentes não podem administrar outros acessos de gerente" });
    }
    if (userId === auth.sub && (parsed.data.role !== undefined || parsed.data.isActive === false)) {
      return reply.status(409).send({ error: "Você não pode alterar seu próprio perfil ou desativar seu acesso" });
    }

    const [row] = await db
      .update(users)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.password !== undefined && {
          passwordHash: await bcrypt.hash(parsed.data.password, 10),
        }),
      })
      .where(and(eq(users.id, userId), eq(users.restaurantId, auth.restaurantId)))
      .returning(safeColumns);

    if (!row) return reply.status(404).send({ error: "User not found" });
    return row;
  });

  app.delete("/me/users/:userId", async (request, reply) => {
    const auth = getAuthUser(request);
    if (!canManage(auth.role)) return reply.status(403).send({ error: "Sem permissão" });

    const userId = parseId((request.params as { userId: string }).userId);
    if (!userId) return reply.status(400).send({ error: "Invalid user id" });
    if (userId === auth.sub) {
      return reply.status(409).send({ error: "Você não pode remover o próprio acesso" });
    }
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.restaurantId, auth.restaurantId)))
      .limit(1);
    if (!target) return reply.status(404).send({ error: "User not found" });
    if (target.role === "owner") {
      return reply.status(409).send({ error: "O acesso do proprietário não pode ser removido por esta tela" });
    }
    if (auth.role === "gerente" && target.role === "gerente") {
      return reply.status(403).send({ error: "Gerentes não podem remover outros acessos de gerente" });
    }

    const [row] = await db
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.restaurantId, auth.restaurantId)))
      .returning({ id: users.id });

    if (!row) return reply.status(404).send({ error: "User not found" });
    return reply.status(204).send();
  });
}
