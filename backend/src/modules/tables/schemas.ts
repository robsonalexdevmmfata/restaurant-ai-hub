import { z } from "zod";

export const createTableSchema = z.object({
  label: z.string().min(1).max(60),
  seats: z.coerce.number().int().min(1).max(50).default(4),
  isActive: z.boolean().default(true),
});

export const updateTableSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  seats: z.coerce.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const closeSessionSchema = z.object({
  paymentMethod: z.enum(["dinheiro", "pix", "cartao", "outros"]),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
