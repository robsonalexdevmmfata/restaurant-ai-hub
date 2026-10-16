import { useEffect, useState } from "react";

export type ThermalSettings = { logo: string; footer: string; showLogo: boolean };
export const defaultThermalSettings: ThermalSettings = { logo: "", footer: "Obrigado pela preferência! Volte sempre.", showLogo: true };
const prefix = "restaurantai.thermal-settings.";
const eventName = "restaurantai:thermal-settings";

export function getThermalSettings(slug: string): ThermalSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(prefix + slug) ?? "null") as Partial<ThermalSettings> | null;
    return {
      logo: typeof saved?.logo === "string" && saved.logo.startsWith("data:image/png;base64,") ? saved.logo : "",
      footer: typeof saved?.footer === "string" ? saved.footer : defaultThermalSettings.footer,
      showLogo: typeof saved?.showLogo === "boolean" ? saved.showLogo : true,
    };
  } catch { return defaultThermalSettings; }
}

export function saveThermalSettings(slug: string, settings: ThermalSettings) {
  window.localStorage.setItem(prefix + slug, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(eventName, { detail: slug }));
}

export function useThermalSettings(slug: string) {
  const [settings, setSettings] = useState(defaultThermalSettings);
  useEffect(() => {
    const refresh = () => setSettings(getThermalSettings(slug));
    refresh();
    window.addEventListener(eventName, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(eventName, refresh); window.removeEventListener("storage", refresh); };
  }, [slug]);
  return settings;
}

/** Composite transparency onto white, then threshold to pure black or white. */
export function monochromePixels(pixels: Uint8ClampedArray, threshold = 180) {
  const output = new Uint8ClampedArray(pixels);
  for (let i = 0; i < output.length; i += 4) {
    const alpha = (output[i + 3] ?? 255) / 255;
    const luminance = (0.299 * (output[i] ?? 0) + 0.587 * (output[i + 1] ?? 0) + 0.114 * (output[i + 2] ?? 0)) * alpha + 255 * (1 - alpha);
    const value = luminance < threshold ? 0 : 255;
    output[i] = value; output[i + 1] = value; output[i + 2] = value; output[i + 3] = 255;
  }
  return output;
}

export async function convertThermalLogo(source: string, threshold = 180): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 384 / image.width, 240 / image.height);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível converter a logo.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  data.data.set(monochromePixels(data.data, threshold));
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}