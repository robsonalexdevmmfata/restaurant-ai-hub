import { z } from "zod";

export const productStatusSchema = z.enum(["DISPONIVEL", "INDISPONIVEL"]);

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.coerce.number().positive(),
  category: z.string().max(100).optional(),
  status: productStatusSchema.default("DISPONIVEL"),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
