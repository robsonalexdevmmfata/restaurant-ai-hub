import { z } from "zod";

export const productStatusSchema = z.enum(["DISPONIVEL", "INDISPONIVEL"]);

export const createProductSchema = z.object({
  menuId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.coerce.number().positive(),
  category: z.string().max(100).optional(),
  status: productStatusSchema.default("DISPONIVEL"),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  menuId: z.coerce.number().int().positive().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
