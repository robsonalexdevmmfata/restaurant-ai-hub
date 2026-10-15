import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

export async function requireApiSecret(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers["x-api-secret"];
  if (secret !== env.API_SECRET) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

/** JWT via Authorization: Bearer ou ?access_token= (SSE/EventSource). */
export async function requireJwt(request: FastifyRequest, reply: FastifyReply) {
  const queryToken = (request.query as { access_token?: string }).access_token;
  if (queryToken && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${queryToken}`;
  }

  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }

  const auth = request.user;
  const [user] = await db
    .select({ restaurantId: users.restaurantId, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, auth.sub), eq(users.restaurantId, auth.restaurantId)))
    .limit(1);
  if (!user || !user.isActive || user.role !== auth.role) {
    return reply.status(401).send({ error: "This account is inactive or its permissions have changed. Sign in again." });
  }
}

export function getAuthUser(request: FastifyRequest) {
  return request.user;
}
