import { z } from "zod";

export const registerSchema = z.object({
  restaurantName: z.string().min(2).max(255),
  whatsappInstance: z.string().min(2).max(255),
  aiInstructions: z.string().optional(),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
