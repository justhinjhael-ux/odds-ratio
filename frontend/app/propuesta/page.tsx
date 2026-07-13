"use client";
// ## ==========================================================================
// ## app/propuesta/page.tsx — Historia 2: propuesta explicable.
// ## Perfil + confianza bayesiana, distribución por clase, fan chart Normal-
// ## Normal (percentiles, nunca una promesa) y comparación con Markowitz.
// ##
// ## NOTA DE DISEÑO: solo se rediseñó la CAPA VISUAL (contenedores premium /
// ## glassmorphism). Los gráficos Recharts (Pie/Area/Bar) quedan intactos por
// ## dentro; ninguna lógica, cálculo, dato o llamada API fue modificado.
// ## ==========================================================================
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { MarkowitzResult, Proposal, getMarkowitz, getProposal } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const COLORES = ["#5B18D9", "#8A2BE2", "#A855F7", "#C4B5FD", "#E9D5FF"];

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
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-28 text-center animate-rise">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
        <div className="absolute inset-0 rounded-full border-4 border-t-brand-600 border-transparent animate-spin" />
      </div>
      <p className="mt-5 font-semibold text-brand-900">Construyendo tu propuesta…</p>
      <p className="text-sm text-slate-500 mt-1">Perfilando riesgo y proyecciones</p>
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getProposal(Number(id))
      .then((p) => {
        setPropuesta(p);
        return getMarkowitz(p.perfil);
      })
      .then(setMarkowitz)
      .catch(() => setError("No se pudo cargar la propuesta."));
  }, [id]);

  if (error)
    return (
      <p className="text-center text-red-600 py-20 max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl">
        {error}
      </p>
    );
  if (!propuesta) return <LoadingState />;

  const confianzaPct = Math.round(propuesta.confianza * 100);
  const distribucionData = propuesta.distribucion.map((d) => ({ name: d.nombre, value: d.porcentaje }));
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
          {/* Anillo circular moderno — SOLO contenedor visual de la confianza */}
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
            <p className="text-[11px] uppercase tracking-widest text-white/70">Tu perfil</p>
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

      {/* ## Fila de estadísticas clave — solo presentación, mismos datos ya recibidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-premium p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Horizonte</p>
          <p className="text-lg font-extrabold text-brand-900 mt-1">
            {propuesta.proyeccion.horizonte_meses}
            <span className="text-xs font-semibold text-slate-400 ml-1">meses</span>
          </p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Riesgo esperado</p>
          <p className="text-lg font-extrabold text-brand-900 mt-1">
            {(propuesta.proyeccion.volatilidad_mensual * 100).toFixed(1)}
            <span className="text-xs font-semibold text-slate-400 ml-1">% mensual</span>
          </p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Diversificación</p>
          <p className="text-lg font-extrabold text-brand-900 mt-1">
            {propuesta.distribucion.length}
            <span className="text-xs font-semibold text-slate-400 ml-1">clases de activo</span>
          </p>
        </div>
      </div>

      {/* ## Distribución propuesta — el GRÁFICO no se toca; solo el contenedor */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-brand-900">Distribución propuesta</h2>
          <span className="text-xs font-semibold text-slate-400">Diversificación por clase</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={distribucionData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
              {distribucionData.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {/* Cada activo en una tarjeta moderna (usa los mismos datos de distribución) */}
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          {propuesta.distribucion.map((d, i) => (
            <div
              key={d.nombre}
              className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/60 backdrop-blur-md px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span
                className="h-9 w-9 rounded-xl shrink-0 shadow-inner"
                style={{ background: COLORES[i % COLORES.length] }}
              />
              <p className="flex-1 min-w-0 text-sm font-semibold text-brand-900 truncate">{d.nombre}</p>
              <span className="text-lg font-extrabold text-brand-700">{d.porcentaje}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ## Proyección (fan chart) — gráfico intacto */}
      <div className="card-premium p-6">
        <h2 className="font-bold text-brand-900 mb-1">Proyección (fan chart)</h2>
        <p className="text-xs text-slate-400 mb-3">
          Modelo {propuesta.proyeccion.modelo} — mediana + bandas de credibilidad, nunca una promesa.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={propuesta.proyeccion.fan_chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE7FB" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${fmt(v)}`} />
            <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
            <Area type="monotone" dataKey="p95" stroke="none" fill="#EDE7FB" />
            <Area type="monotone" dataKey="p75" stroke="none" fill="#D7C5F7" />
            <Area type="monotone" dataKey="p50" stroke="#5B18D9" strokeWidth={2} fill="#BB96F0" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="#D7C5F7" />
            <Area type="monotone" dataKey="p05" stroke="none" fill="#F7F8FC" />
          </AreaChart>
        </ResponsiveContainer>
        <DisclaimerBanner texto={propuesta.proyeccion.disclaimer} />
      </div>

      {markowitz && (
        <div className="card-premium p-6">
          <h2 className="font-bold text-brand-900 mb-1">Comparación con Markowitz</h2>
          <p className="text-xs text-slate-400 mb-3">{markowitz.nota}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={propuesta.distribucion.map((d) => ({
                clase: d.nombre,
                Reglas: d.porcentaje,
                Markowitz: markowitz.pesos[d.clase] ?? 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE7FB" />
              <XAxis dataKey="clase" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Reglas" fill="#5B18D9" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Markowitz" fill="#A855F7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ## Explicación IA */}
      <div className="card-premium p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center text-white text-sm">
            ✨
          </span>
          <h2 className="font-bold text-brand-900">Explicación</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{propuesta.explicacion}</p>
        {propuesta.guardrail_activado && (
          <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Nota: se activó el guardrail antialucinación en la redacción de esta explicación.
          </p>
        )}
      </div>
    </div>
  );
}
