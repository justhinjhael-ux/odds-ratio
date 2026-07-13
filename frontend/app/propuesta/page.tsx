"use client";
// ## ==========================================================================
// ## app/propuesta/page.tsx — Historia 2: propuesta explicable.
// ## Perfil + confianza bayesiana, distribución por clase, fan chart Normal-
// ## Normal (percentiles, nunca una promesa) y comparación con Markowitz.
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

export default function PropuestaPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-500 py-20">Cargando propuesta…</p>}>
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

  if (error) return <p className="text-center text-red-600 py-20">{error}</p>;
  if (!propuesta) return <p className="text-center text-slate-500 py-20">Cargando propuesta…</p>;

  const confianzaPct = Math.round(propuesta.confianza * 100);
  const distribucionData = propuesta.distribucion.map((d) => ({ name: d.nombre, value: d.porcentaje }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card-premium p-6">
        <span className="text-xs font-bold text-brand-500 uppercase tracking-wide">Tu perfil</span>
        <h1 className="text-2xl font-extrabold text-brand-900 capitalize mt-1">{propuesta.perfil}</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-2 rounded-full bg-brand-50 overflow-hidden">
            <div className="h-full bg-brand-600" style={{ width: `${confianzaPct}%` }} />
          </div>
          <span className="text-sm font-semibold text-brand-700">{confianzaPct}% confianza bayesiana</span>
        </div>
        {propuesta.estado !== "pendiente" && (
          <span className="inline-block mt-3 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-pill bg-success-400/20 text-success-500">
            {propuesta.estado}
          </span>
        )}
      </div>

      <div className="card-premium p-6">
        <h2 className="font-bold text-brand-900 mb-3">Distribución propuesta</h2>
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
      </div>

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

      <div className="card-premium p-6">
        <h2 className="font-bold text-brand-900 mb-2">Explicación</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{propuesta.explicacion}</p>
        {propuesta.guardrail_activado && (
          <p className="text-xs text-amber-600 mt-2">
            Nota: se activó el guardrail antialucinación en la redacción de esta explicación.
          </p>
        )}
      </div>
    </div>
  );
}
