import type { FastifyInstance } from "fastify";

import { isUniqueViolation } from "../../lib/helpers.js";
import { getAuthUser, requireJwt } from "../../middleware/auth.js";
import { loginSchema, registerSchema } from "./schemas.js";
import * as authService from "./service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    try {
      const { user, restaurant } = await authService.registerOwner(parsed.data);
      const token = await reply.jwtSign({
        sub: user.id,
        restaurantId: user.restaurantId,
        email: user.email,
        role: user.role,
      });

      return reply.status(201).send({
        token,
        user: { id: user.id, email: user.email, role: user.role },
        restaurant,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.status(409).send({ error: "Email ou instância WhatsApp já cadastrados" });
      }
      throw error;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const result = await authService.verifyLogin(parsed.data.email, parsed.data.password);
    if (!result || !result.restaurant) {
      return reply.status(401).send({ error: "Email ou senha inválidos" });
    }

    const token = await reply.jwtSign({
      sub: result.user.id,
      restaurantId: result.user.restaurantId,
      email: result.user.email,
      role: result.user.role,
    });

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      restaurant: result.restaurant,
    };
  });

  app.get("/auth/me", { preHandler: requireJwt }, async (request, reply) => {
    const auth = getAuthUser(request);
    const user = await authService.findUserById(auth.sub);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, restaurantId: auth.restaurantId };
  });
}
