import { X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export const inputCls =
  "w-full rounded-md bg-white px-3 py-2 text-[13px] ring-1 ring-black/10 outline-none placeholder-stone-400 focus:ring-2 focus:ring-brand/40";

export function Btn({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v =
    variant === "primary"
      ? "bg-brand text-white ring-brand/30 hover:bg-brand-deep"
      : variant === "danger"
        ? "bg-white text-red-600 ring-red-200 hover:bg-red-50"
        : "bg-white text-ink ring-black/10 hover:bg-stone-50";
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium ring-1 transition-colors disabled:opacity-60 ${v} ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-[15px] font-semibold">{title}</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-stone-400 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-[13px] text-stone-500">{children}</div>;
}

/** Carrega dados assíncronos com recarregamento manual (e opcional a cada N ms). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    fn()
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro ao carregar"));
  }, deps);
  useEffect(() => {
    reload();
    if (!pollMs) return;
    const t = window.setInterval(reload, pollMs);
    return () => window.clearInterval(t);
  }, [reload, pollMs]);
  return { data, error, reload };
}

export function PageGate() {
  return <div className="min-h-screen bg-stone-100" />;
}
