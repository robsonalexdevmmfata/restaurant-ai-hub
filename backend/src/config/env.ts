import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://admin:123456@localhost:5432/restaurante"),
  JWT_SECRET: z.string().min(16).default("restauranteai-jwt-dev-secret"),
  API_SECRET: z.string().min(8).default("dev-secret-change-me"),
});

export const env = envSchema.parse(process.env);
