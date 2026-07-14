// ## ==========================================================================
// ## components/Skeleton.tsx — Estados de carga modernos (skeleton loading).
// ## Reemplazan spinners genéricos por siluetas del contenido real que está
// ## por llegar, para que el usuario nunca sienta que "no pasa nada".
// ## ==========================================================================

export function SkeletonLine({ width = "100%", height = "0.9rem" }: { width?: string; height?: string }) {
  return <div className="skeleton-block" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="card-premium p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine width="55%" height="1rem" />
        <SkeletonLine width="20%" height="1.4rem" />
      </div>
      <SkeletonLine width="70%" height="0.7rem" />
      <SkeletonLine width="90%" height="0.7rem" />
      <SkeletonLine width="40%" height="0.7rem" />
    </div>
  );
}

export function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Cargando clientes…">
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card-premium p-6 space-y-4" aria-busy="true" aria-label="Cargando gráfico…">
      <SkeletonLine width="45%" height="1rem" />
      <div className="skeleton-block" style={{ width: "100%", height: "220px" }} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr className="border-t border-white/60" aria-busy="true">
      <td className="px-4 py-3"><SkeletonLine width="80%" /></td>
      <td className="px-4 py-3"><SkeletonLine width="60%" /></td>
      <td className="px-4 py-3"><SkeletonLine width="50%" /></td>
      <td className="px-4 py-3"><SkeletonLine width="70%" /></td>
      <td className="px-4 py-3"><SkeletonLine width="50%" /></td>
      <td className="px-4 py-3"><SkeletonLine width="90%" /></td>
    </tr>
  );
}
