"use client";
// ## ==========================================================================
// ## components/Toast.tsx — Feedback inmediato de acciones (éxito/error/info).
// ## Solo UI: no toca lógica de negocio, únicamente confirma visualmente lo
// ## que ya ocurrió tras llamar a la API (ej. "Decisión registrada").
// ## ==========================================================================
import { createContext, useCallback, useContext, useState } from "react";

type Tipo = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tipo: Tipo;
  titulo: string;
  detalle?: string;
}
interface ToastContextValue {
  mostrar: (titulo: string, tipo?: Tipo, detalle?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const ESTILO: Record<Tipo, { icon: string; bg: string }> = {
  success: { icon: "✓", bg: "from-success-400 to-success-500" },
  error: { icon: "✕", bg: "from-red-400 to-red-500" },
  info: { icon: "ℹ", bg: "from-brand-500 to-brand-700" },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const mostrar = useCallback((titulo: string, tipo: Tipo = "info", detalle?: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tipo, titulo, detalle }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 items-end pointer-events-none max-w-[92vw]">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 pl-3.5 pr-4 py-3 rounded-2xl text-white shadow-deep bg-gradient-to-b ${ESTILO[t.tipo].bg} animate-slide-in-right w-80 max-w-full`}
          >
            <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {ESTILO[t.tipo].icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug">{t.titulo}</p>
              {t.detalle && <p className="text-xs text-white/85 mt-0.5 leading-snug">{t.detalle}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
