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
  EVOLUTION_API_URL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().optional(),
  ),
  EVOLUTION_API_KEY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
}).superRefine((values, context) => {
  if (Boolean(values.EVOLUTION_API_URL) !== Boolean(values.EVOLUTION_API_KEY)) {
    context.addIssue({
      code: "custom",
      message: "EVOLUTION_API_URL e EVOLUTION_API_KEY devem ser configuradas juntas.",
      path: ["EVOLUTION_API_KEY"],
    });
  }
});

export const env = envSchema.parse(process.env);
