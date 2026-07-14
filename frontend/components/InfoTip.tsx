"use client";
// ## ==========================================================================
// ## components/InfoTip.tsx — Ayuda contextual junto a cifras/decisiones clave.
// ## IA explicable: cada número importante puede responder "¿cómo se calculó?"
// ## sin que el usuario tenga que ir a buscarlo. Solo presentación — el texto
// ## se pasa como prop, nunca se inventa aquí.
// ## ==========================================================================
import { useState } from "react";

export default function InfoTip({ texto, label = "¿Cómo se calculó esto?" }: { texto: string; label?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        aria-label={label}
        className="h-4 w-4 rounded-full bg-brand-100 text-brand-600 text-[10px] font-bold flex items-center justify-center hover:bg-brand-200 transition-colors"
      >
        ?
      </button>
      {abierto && (
        <span className="absolute z-40 left-1/2 -translate-x-1/2 top-6 w-56 text-left card-premium !rounded-xl p-3 text-xs text-slate-600 leading-relaxed shadow-deep animate-rise">
          {texto}
        </span>
      )}
    </span>
  );
}
