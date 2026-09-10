import { z } from "zod";

export const orderStatusSchema = z.enum(["PENDENTE", "PREPARANDO", "ENTREGUE", "CANCELADO"]);

export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

export const createOrderSchema = z.object({
  whatsappInstance: z.string().min(1),
  customerPhone: z.string().min(8).max(30),
  orderDetails: z.string().min(1),
  status: orderStatusSchema.default("PENDENTE"),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
