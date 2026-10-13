import { useEffect, useState } from "react";

export type ToastVariant = "success" | "info" | "warning" | "error";

export type ToastMessage = {
  id: number;
  title: string;
  description?: string | undefined;
  variant: ToastVariant;
};

const TOAST_EVENT = "restaurantai:toast";

function playTone(variant: ToastVariant) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const audio = new AudioCtor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const frequencies: Record<ToastVariant, number> = {
      success: 660,
      info: 520,
      warning: 440,
      error: 280,
    };

    oscillator.type = variant === "error" ? "sawtooth" : "triangle";
    oscillator.frequency.value = frequencies[variant];
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.12);
    void audio.close();
  } catch {
    // no-op in unsupported browsers
  }
}

export function showToast({ title, description, variant = "info" }: Omit<ToastMessage, "id">) {
  if (typeof window === "undefined") return;
  const message: ToastMessage = {
    id: Date.now() + Math.random(),
    title,
    description,
    variant,
  };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
  playTone(variant);
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastMessage>).detail as ToastMessage | undefined;
      if (!detail) return;
      setItems((prev) => [...prev, detail]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== detail.id));
      }, 3500);
    };

    window.addEventListener(TOAST_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, handler as EventListener);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border border-black/10 bg-white p-3 shadow-lg ring-1 ring-black/5 backdrop-blur ${
            item.variant === "success"
              ? "border-emerald-200 bg-emerald-50"
              : item.variant === "warning"
                ? "border-amber-200 bg-amber-50"
                : item.variant === "error"
                  ? "border-rose-200 bg-rose-50"
                  : "border-sky-200 bg-sky-50"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                item.variant === "success"
                  ? "bg-emerald-500"
                  : item.variant === "warning"
                    ? "bg-amber-500"
                    : item.variant === "error"
                      ? "bg-rose-500"
                      : "bg-sky-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">{item.title}</p>
              {item.description ? <p className="mt-1 text-[12px] text-stone-600">{item.description}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
