import { z } from "zod";

export const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  whatsappInstance: z.string().min(2).max(255).optional(),
  aiInstructions: z.string().optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().max(2048).refine(
    (value) =>
      /^https?:\/\/\S+$/i.test(value) ||
      /^\/(?!\/)\S*$/.test(value),
    "Informe uma URL HTTP(S) ou um caminho local.",
  ).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  faviconUrl: z.string().max(2048).refine(
    (value) => !value || /^https?:\/\/\S+$/i.test(value) || /^\/(?!\/)\S*$/.test(value),
    "Informe uma URL HTTP(S) ou um caminho local.",
  ).nullable().optional(),
  cnpj: z.string().max(20).nullable().optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  kind: z.string().max(60).optional(),
  openingHours: z.string().max(500).optional(),
  webhookUrl: z.string().url().max(2048).nullable().optional(),
  publicPolicy: z.string().max(2000).nullable().optional(),
  isOpen: z.boolean().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

export const restaurantLogoUploadSchema = z.object({
  image: z.string().max(1_400_000).regex(
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/,
    "Envie uma imagem JPEG, PNG ou WebP válida.",
  ),
});

export const restaurantAssetUploadSchema = z.object({
  image: z.string().max(1_400_000).regex(
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/,
    "Envie uma imagem JPEG, PNG ou WebP válida.",
  ),
});

export const promotionUploadSchema = restaurantAssetUploadSchema.extend({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(280).optional(),
});
