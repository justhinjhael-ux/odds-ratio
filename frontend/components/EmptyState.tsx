// ## ==========================================================================
// ## components/EmptyState.tsx — Estados vacíos elegantes con ilustración,
// ## explicación y una acción sugerida. Nunca una pantalla en blanco.
// ## ==========================================================================
export default function EmptyState({
  icono = "🗂️",
  titulo,
  texto,
  accion,
}: {
  icono?: string;
  titulo: string;
  texto: string;
  accion?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card-premium p-10 flex flex-col items-center text-center gap-2 animate-rise">
      <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-3xl mb-1">
        {icono}
      </div>
      <p className="font-bold text-brand-900">{titulo}</p>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{texto}</p>
      {accion && (
        <button
          onClick={accion.onClick}
          className="mt-3 text-sm font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
        >
          {accion.label}
        </button>
      )}
    </div>
  );
}
