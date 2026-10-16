import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { aiRoutes } from "./modules/ai/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { diningTableRoutes } from "./modules/dining-tables/routes.js";
import { deliveryRoutes } from "./modules/deliveries/routes.js";
import { internalRoutes } from "./modules/internal/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import { publicRoutes } from "./modules/public/routes.js";
import { staffRoutes } from "./modules/staff/routes.js";
import { tableRoutes } from "./modules/tables/routes.js";
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
  await app.register(aiRoutes, { prefix: "/api" });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(tableRoutes, { prefix: "/api" });
  await app.register(staffRoutes, { prefix: "/api" });
  await app.register(deliveryRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(internalRoutes, { prefix: "/api" });
  await app.register(publicRoutes, { prefix: "/api" });
  await app.register(diningTableRoutes, { prefix: "/api" });

  return app;
}

export async function startServer() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API rodando em http://localhost:${env.PORT}`);
  app.log.info(`Banco: postgresql://admin:***@localhost:5432/restaurante`);
  return app;
}
