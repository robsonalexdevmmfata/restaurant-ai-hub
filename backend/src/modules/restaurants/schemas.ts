import { z } from "zod";

export const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  whatsappInstance: z.string().min(2).max(255).optional(),
  aiInstructions: z.string().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
