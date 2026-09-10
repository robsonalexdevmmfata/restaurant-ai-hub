import { z } from "zod";

export const conversationModeSchema = z.enum(["ia", "humano"]);

export const upsertConversationSchema = z.object({
  whatsappInstance: z.string().min(1),
  customerPhone: z.string().min(8).max(30),
  mode: conversationModeSchema.optional(),
  cartJson: z.record(z.unknown()).nullable().optional(),
});

export const updateConversationModeSchema = z.object({
  mode: conversationModeSchema,
});

export const updateConversationCartSchema = z.object({
  cartJson: z.record(z.unknown()).nullable(),
});

export type UpsertConversationInput = z.infer<typeof upsertConversationSchema>;
export type UpdateConversationModeInput = z.infer<typeof updateConversationModeSchema>;
export type UpdateConversationCartInput = z.infer<typeof updateConversationCartSchema>;
