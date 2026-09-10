import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/routes.js";
import { internalRoutes } from "./modules/internal/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import "./types/jwt.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Secret"],
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "7d" },
  });

  app.get("/health", async () => ({
    ok: true,
    service: "restauranteai-api",
    database: "restaurante",
  }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(internalRoutes, { prefix: "/api" });

  return app;
}

export async function startServer() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API rodando em http://localhost:${env.PORT}`);
  app.log.info(`Banco: postgresql://admin:***@localhost:5432/restaurante`);
  return app;
}
