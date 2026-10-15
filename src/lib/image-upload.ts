const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function readImageAsDataUrl(file: File, maxBytes = 1_000_000): Promise<string> {
  if (!supportedImageTypes.has(file.type)) {
    return Promise.reject(new Error("Use uma imagem JPG, PNG ou WebP."));
  }
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`A imagem deve ter no máximo ${Math.floor(maxBytes / 1_000_000)} MB.`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("O arquivo selecionado não contém uma imagem válida."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
