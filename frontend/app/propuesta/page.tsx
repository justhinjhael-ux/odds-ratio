"use client";
// ## ==========================================================================
// ## app/propuesta/page.tsx — Historia 2: propuesta explicable.
// ## Tarjeta de perfil + confianza bayesiana (contenedor visual propio de
// ## esta pantalla) y el resto del análisis vía <AnalisisEstadistico>,
// ## componente COMPARTIDO también con el Panel Operativo del asesor.
// ## ==========================================================================
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AnalisisEstadistico from "@/components/AnalisisEstadistico";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import { SkeletonLine } from "@/components/Skeleton";
import {
  CorrelationMatrix,
  MarkowitzResult,
  Proposal,
  getCorrelacion,
  getMarkowitz,
  getProposal,
  normalizarDistribucion,
} from "@/lib/api";

// ## Mapa presentacional perfil→estilo (solo color/etiqueta, sin lógica de negocio)
function nivelRiesgo(perfil: string) {
  const p = perfil.toLowerCase();
  if (p.includes("conserv"))
    return { label: "Riesgo Conservador", chip: "bg-success-400/20 text-success-500", accent: "#10B981" };
  if (p.includes("agres"))
    return { label: "Riesgo Agresivo", chip: "bg-accent/15 text-accent", accent: "#A855F7" };
  return { label: "Riesgo Moderado", chip: "bg-brand-100 text-brand-700", accent: "#5B18D9" };
}

function LoadingState() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-brand-600 border-transparent animate-spin" />
        </div>
        <p className="font-semibold text-brand-900">Construyendo tu propuesta…</p>
        <p className="text-sm text-slate-500 -mt-2">
          Perfilando riesgo con Bayes, proyectando escenarios y comparando contra Markowitz
        </p>
      </div>
      <div className="skeleton-block" style={{ width: "100%", height: "150px", borderRadius: "1.75rem" }} />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: "72px", borderRadius: "1.75rem" }} />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ width: "100%", height: "220px", borderRadius: "1.75rem" }} />
      ))}
    </div>
  );
}

export default function PropuestaPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PropuestaContenido />
    </Suspense>
  );
}

function PropuestaContenido() {
  const params = useSearchParams();
  const id = params.get("id");
  const [propuesta, setPropuesta] = useState<Proposal | null>(null);
  const [markowitz, setMarkowitz] = useState<MarkowitzResult | null>(null);
  const [correlacion, setCorrelacion] = useState<CorrelationMatrix | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getProposal(Number(id))
      .then((p) => {
        setPropuesta(p);
        return Promise.all([getMarkowitz(p.perfil), getCorrelacion()]);
      })
      .then(([mk, corr]) => {
        setMarkowitz(mk);
        setCorrelacion(corr);
      })
      .catch(() => setError("No se pudo cargar la propuesta."));
  }, [id]);

  if (error)
    return (
      <div className="max-w-md mx-auto pt-10">
        <EmptyState
          icono="⚠️"
          titulo="No se pudo cargar la propuesta"
          texto="Puede ser una conexión inestable con el servidor o un enlace vencido. Intenta de nuevo o vuelve a crear tu perfil."
          accion={{ label: "Crear un nuevo perfil", onClick: () => (window.location.href = "/onboarding") }}
        />
      </div>
    );
  if (!propuesta) return <LoadingState />;

  const confianzaPct = Math.round(propuesta.confianza * 100);
  const distribucion = normalizarDistribucion(propuesta.distribucion);
  const riesgo = nivelRiesgo(propuesta.perfil);
  const ring = 2 * Math.PI * 42; // circunferencia del anillo de confianza (contenedor visual)

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-rise">
      {/* ## Encabezado */}
      <header className="text-center pt-2">
        <span className="inline-flex items-center gap-2 rounded-pill bg-white/60 backdrop-blur-md border border-white/70 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
          Tu propuesta personalizada
        </span>
      </header>

      {/* ## Tarjeta premium del PERFIL con anillo circular (contenedor visual) */}
      <div className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-deep bg-gradient-to-br from-brand-700 via-brand-600 to-secondary">
        <div className="pointer-events-none absolute -top-10 -right-8 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-brand-950/30 blur-2xl" />
        <div className="relative flex items-center gap-6">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#ffffff"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - confianzaPct / 100)}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.25,0.1,0.25,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold">{confianzaPct}%</span>
              <span className="text-[10px] uppercase tracking-widest text-white/70">confianza</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/70 flex items-center gap-1.5">
              Tu perfil
              <span className="[&_button]:bg-white/25 [&_button]:text-white [&_button:hover]:bg-white/40">
                <InfoTip
                  label="¿Cómo se calculó tu perfil y tu confianza?"
                  texto={`Fuiste clasificado como "${propuesta.perfil}" según reglas versionadas sobre tus respuestas. La confianza (${confianzaPct}%) es un modelo bayesiano (Beta-Binomial) que mide qué tan seguro está el sistema de esa clasificación — y se afina con cada decisión que toman los asesores humanos.`}
                />
              </span>
            </p>
            <h1 className="text-3xl font-extrabold capitalize leading-tight">{propuesta.perfil}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-pill bg-white/20 backdrop-blur-md border border-white/30">
                {riesgo.label}
              </span>
              {propuesta.estado !== "pendiente" && (
                <span className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-pill bg-success-400/30 border border-white/20">
                  {propuesta.estado}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnalisisEstadistico
        perfil={propuesta.perfil}
        score={propuesta.score}
        influencias={propuesta.influencias}
        distribucion={distribucion}
        proyeccion={propuesta.proyeccion}
        markowitz={markowitz}
        correlacion={correlacion}
        explicacion={propuesta.explicacion}
        guardrailActivado={propuesta.guardrail_activado}
      />

      {/* ## Confianza: responde "¿qué sigue?" — nunca dejar al usuario sin saber el próximo paso */}
      <div className="card-premium p-6 bg-gradient-to-br from-brand-50 to-white">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white text-sm">
            🧭
          </span>
          <h2 className="font-bold text-brand-900">¿Qué sigue?</h2>
        </div>
        <ol className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
          <li className="flex gap-2.5">
            <span className="shrink-0 h-5 w-5 rounded-full bg-success-400/20 text-success-600 text-[11px] font-bold flex items-center justify-center mt-0.5">✓</span>
            Tu propuesta ya está generada con los modelos estadísticos vigentes.
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 h-5 w-5 rounded-full bg-amber-100 text-amber-600 text-[11px] font-bold flex items-center justify-center mt-0.5 animate-pulse">
              ●
            </span>
            Un asesor humano autorizado la revisará antes de cualquier acción — nada se ejecuta automáticamente.
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 h-5 w-5 rounded-full bg-slate-100 text-slate-400 text-[11px] font-bold flex items-center justify-center mt-0.5">3</span>
            Si tienes dudas mientras esperas, el centro de ayuda (ícono ❔ abajo a la izquierda) tiene respuestas y acceso directo al Chat ORAI.
          </li>
        </ol>
        <p className="text-xs text-slate-400 mt-4">
          🔒 Tus datos son ficticios en este entorno de demostración y nunca se comparten con terceros.
        </p>
      </div>
    </div>
  );
}
