export function validateImageUpload(file: Pick<File, "type" | "size">): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Use uma imagem PNG, JPG ou WebP.";
  if (file.size > 1_000_000) return "A imagem deve ter até 1 MB.";
  return null;
}