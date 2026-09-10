import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../config/env.js";

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
}

export function getAuthUser(request: FastifyRequest) {
  return request.user;
}
