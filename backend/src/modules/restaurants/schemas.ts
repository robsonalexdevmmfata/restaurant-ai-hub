import { z } from "zod";

export const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string().min(2).max(255).optional(),
  whatsappInstance: z.string().min(2).max(255).optional(),
  aiInstructions: z.string().optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().max(2000).optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  kind: z.string().max(60).optional(),
  openingHours: z.string().max(500).optional(),
  isOpen: z.boolean().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
