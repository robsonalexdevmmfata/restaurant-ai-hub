import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1).default("postgresql://admin:123456@localhost:5432/restaurante"),
    JWT_SECRET: z.string().min(16).default("restauranteai-jwt-dev-secret"),
    API_SECRET: z.string().min(8).default("dev-secret-change-me"),
    EVOLUTION_API_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    EVOLUTION_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    N8N_EVOLUTION_WEBHOOK_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    EVOLUTION_WEBHOOK_TOKEN: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
    GROK_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    GROK_MODEL: z.string().min(1).default("grok-4.20-0309-non-reasoning"),
    PUBLIC_API_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    PUBLIC_APP_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
  })
  .superRefine((values, context) => {
    if (Boolean(values.EVOLUTION_API_URL) !== Boolean(values.EVOLUTION_API_KEY)) {
      context.addIssue({
        code: "custom",
        message: "EVOLUTION_API_URL e EVOLUTION_API_KEY devem ser configuradas juntas.",
        path: ["EVOLUTION_API_KEY"],
      });
    }
    if (Boolean(values.EVOLUTION_WEBHOOK_TOKEN) !== Boolean(values.GROK_API_KEY)) {
      context.addIssue({
        code: "custom",
        message: "EVOLUTION_WEBHOOK_TOKEN e GROK_API_KEY devem ser configurados juntos.",
        path: ["EVOLUTION_WEBHOOK_TOKEN"],
      });
    }
    if (values.EVOLUTION_WEBHOOK_TOKEN && !values.EVOLUTION_API_URL) {
      context.addIssue({
        code: "custom",
        message:
          "EVOLUTION_API_URL e EVOLUTION_API_KEY são necessários para responder pelo WhatsApp.",
        path: ["EVOLUTION_API_URL"],
      });
    }
    if (values.EVOLUTION_WEBHOOK_TOKEN && !values.PUBLIC_API_URL) {
      context.addIssue({
        code: "custom",
        message:
          "Configure PUBLIC_API_URL com o endereço alcançável do backend para receber webhooks da Evolution.",
        path: ["PUBLIC_API_URL"],
      });
    }
  });

export const env = envSchema.parse(process.env);
