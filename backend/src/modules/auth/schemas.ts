import { z } from "zod";

export const registerSchema = z.object({
  restaurantName: z.string().min(2).max(255),
  whatsappInstance: z.string().min(2).max(255).optional(),
  aiInstructions: z.string().optional(),
  ownerName: z.string().min(2).max(255).optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  kind: z.string().max(60).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
