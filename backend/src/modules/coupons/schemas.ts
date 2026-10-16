import { z } from "zod";

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((code) => code.toLocaleUpperCase("pt-BR")),
    kind: z.enum(["percentual", "valor-fixo", "frete-gratis"]),
    value: z.coerce.number().finite().min(0),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    maxUses: z.coerce.number().int().min(0).max(2_147_483_647),
  })
  .superRefine((coupon, context) => {
    if (coupon.expiresAt <= coupon.startsAt) {
      context.addIssue({
        code: "custom",
        message: "A data de validade deve ser posterior ao início.",
        path: ["expiresAt"],
      });
    }
    if (coupon.kind === "percentual" && (coupon.value <= 0 || coupon.value > 100)) {
      context.addIssue({
        code: "custom",
        message: "O percentual deve ser maior que 0 e no máximo 100.",
        path: ["value"],
      });
    }
    if (coupon.kind === "valor-fixo" && coupon.value <= 0) {
      context.addIssue({
        code: "custom",
        message: "O desconto deve ser maior que zero.",
        path: ["value"],
      });
    }
    if (coupon.kind === "frete-gratis" && coupon.value !== 0) {
      context.addIssue({
        code: "custom",
        message: "Cupons de frete grátis não recebem valor de desconto.",
        path: ["value"],
      });
    }
  });

export const updateCouponSchema = z.object({ active: z.boolean() });
