"use client";
// ## ==========================================================================
// ## app/propuesta/page.tsx — Historia 2: propuesta explicable.
// ## Perfil + confianza bayesiana, distribución por clase, mapa de calor de
// ## correlación, velas japonesas (fan chart Normal-Normal reinterpretado) y
// ## ojiva (histograma + frecuencia acumulada del Monte Carlo) — SIN torta:
// ## para un análisis estadístico serio la distribución va en barras.
// ##
// ## NOTA DE DISEÑO: solo capa visual + nuevos endpoints de solo lectura que
// ## exponen datos que el backend YA calculaba internamente (histograma del
// ## valor final, matriz de correlación, influencias por pregunta). Ningún
// ## modelo, fórmula ni cálculo existente fue modificado.
// ## ==========================================================================
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import {
  CorrelationMatrix,
  FanChartPoint,
  MarkowitzResult,
  Proposal,
  getCorrelacion,
  getMarkowitz,
  getProposal,
  normalizarDistribucion,
} from "@/lib/api";

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

// ## ---------- Velas japonesas: reinterpreta el fan chart (p05/p25/p50/p75/p95) ----------
// ## como OHLC estadístico: low=p05, open=p25, close=p75, high=p95, con p50 como
// ## marca de mediana. Mismo dato del Monte Carlo, otra geometría de lectura.
function VelasJaponesas({ datos }: { datos: FanChartPoint[] }) {
  const paso = Math.max(1, Math.ceil(datos.length / 14)); // máx ~14 velas legibles
  const muestra = datos.filter((_, i) => i % paso === 0);
  const min = Math.min(...muestra.map((d) => d.p05));
  const max = Math.max(...muestra.map((d) => d.p95));
  const rango = max - min || 1;
  const W = 700;
  const H = 260;
  const padY = 20;
  const anchoVela = W / muestra.length;
  const y = (v: number) => H - padY - ((v - min) / rango) * (H - 2 * padY);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64">
      {muestra.map((d, i) => {
        const cx = i * anchoVela + anchoVela / 2;
        const prevP50 = i > 0 ? muestra[i - 1].p50 : d.p50;
        const sube = d.p50 >= prevP50;
        const color = sube ? "#10B981" : "#E11D48";
        const bodyTop = y(Math.max(d.p25, d.p75));
        const bodyBottom = y(Math.min(d.p25, d.p75));
        return (
          <g key={d.mes}>
            {/* mecha: p05 -> p95 */}
            <line x1={cx} x2={cx} y1={y(d.p05)} y2={y(d.p95)} stroke={color} strokeWidth={1.5} />
            {/* cuerpo: p25 -> p75 */}
            <rect
              x={cx - anchoVela * 0.28}
              y={bodyTop}
              width={anchoVela * 0.56}
              height={Math.max(2, bodyBottom - bodyTop)}
              fill={color}
              opacity={0.85}
              rx={1.5}
            />
            {/* marca de mediana p50 */}
            <line x1={cx - anchoVela * 0.28} x2={cx + anchoVela * 0.28} y1={y(d.p50)} y2={y(d.p50)} stroke="#1A0836" strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
}

// ## ---------- Mapa de calor: correlación real entre clases de activo ----------
function MapaCalor({ datos }: { datos: CorrelationMatrix }) {
  const color = (v: number) => {
    // escala divergente: -1 rosa, 0 blanco, +1 morado de marca
    if (v >= 0) return `rgba(91, 24, 217, ${0.12 + v * 0.75})`;
    return `rgba(225, 29, 72, ${0.12 + Math.abs(v) * 0.75})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs mx-auto">
        <thead>
          <tr>
            <th className="p-1.5" />
            {datos.clases.map((c) => (
              <th key={c} className="p-1.5 font-semibold text-brand-700 text-[10px] max-w-[70px]">
                {c.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.matriz.map((fila, i) => (
            <tr key={datos.clases[i]}>
              <td className="p-1.5 font-semibold text-brand-700 text-[10px] text-right whitespace-nowrap">
                {datos.clases[i].replaceAll("_", " ")}
              </td>
              {fila.map((v, j) => (
                <td key={j} className="p-0">
                  <div
                    className="h-11 w-14 flex items-center justify-center font-bold rounded-sm m-0.5"
                    style={{ background: color(v), color: Math.abs(v) > 0.5 ? "white" : "#1A0836" }}
                    title={`ρ(${datos.clases[i]}, ${datos.clases[j]}) = ${v}`}
                  >
                    {v.toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
      <p className="text-center text-red-600 py-20 max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl">
        {error}
      </p>
    );
  if (!propuesta) return <LoadingState />;

  const confianzaPct = Math.round(propuesta.confianza * 100);
  const distribucion = normalizarDistribucion(propuesta.distribucion);
  const riesgo = nivelRiesgo(propuesta.perfil);
  const ring = 2 * Math.PI * 42; // circunferencia del anillo de confianza (contenedor visual)
  const histograma = propuesta.proyeccion.histograma_valor_final ?? [];
  const probPerdida = propuesta.proyeccion.prob_perdida_capital_pct;

  // ## ---------- Análisis estadístico ÚNICO de ESTE formulario (datos reales de ESTA propuesta) ----------
  const influencias = propuesta.influencias ?? [];
  const factorDominante = influencias.length
    ? influencias.reduce((max, i) => (i.puntos > max.puntos ? i : max), influencias[0])
    : null;
  const factorConservador = influencias.length
    ? influencias.reduce((min, i) => (i.puntos < min.puntos ? i : min), influencias[0])
    : null;
  const desviacionMarkowitz = markowitz
    ? distribucion.reduce((sum, d) => sum + Math.abs(d.porcentaje - (markowitz.pesos[d.clase] ?? 0)), 0) / distribucion.length
    : null;

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

      {/* ## Fila de estadísticas clave */}
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
            {distribucion.length}
            <span className="text-xs font-semibold text-slate-400 ml-1">clases de activo</span>
          </p>
        </div>
      </div>

      {/* ## Distribución propuesta — BARRAS (nunca torta: no es apta para comparar proporciones con precisión) */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-brand-900">Distribución propuesta</h2>
          <span className="text-xs font-semibold text-slate-400">% por clase de activo</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={distribucion} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE7FB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="porcentaje" radius={[0, 8, 8, 0]}>
              {distribucion.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ## Mapa de calor — correlación empírica real entre clases riesgosas */}
      {correlacion && (
        <div className="card-premium p-6">
          <h2 className="font-bold text-brand-900 mb-1">Mapa de calor — correlación entre activos</h2>
          <p className="text-xs text-slate-400 mb-4">
            Correlación de Pearson empírica (ρ), calculada de los mismos retornos históricos que usa Markowitz.
          </p>
          <MapaCalor datos={correlacion} />
        </div>
      )}

      {/* ## Velas japonesas — reinterpretación del fan chart Normal-Normal */}
      <div className="card-premium p-6">
        <h2 className="font-bold text-brand-900 mb-1">Proyección — velas japonesas</h2>
        <p className="text-xs text-slate-400 mb-3">
          Cada vela = un mes simulado: mecha p05–p95, cuerpo p25–p75, línea = mediana (p50). Verde si la
          mediana sube vs. el mes anterior, roja si baja. Mismo Monte Carlo del modelo {propuesta.proyeccion.modelo}.
        </p>
        <VelasJaponesas datos={propuesta.proyeccion.fan_chart} />
        <DisclaimerBanner texto={propuesta.proyeccion.disclaimer} />
      </div>

      {/* ## Ojiva — histograma + frecuencia acumulada del valor final simulado */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-brand-900">Distribución del resultado final — ojiva</h2>
          <span className="text-xs font-bold text-brand-600">{probPerdida}% prob. de pérdida</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Histograma (barras, {propuesta.proyeccion.n_simulaciones ?? "4000"} simulaciones) + polígono de
          frecuencia acumulada (línea, %) del valor del portafolio al mes {propuesta.proyeccion.horizonte_meses}.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={histograma}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE7FB" />
            <XAxis dataKey="bin_fin" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${fmt(v)}`} />
            <YAxis yAxisId="izq" tick={{ fontSize: 11 }} label={{ value: "frecuencia", angle: -90, fontSize: 10, position: "insideLeft" }} />
            <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip labelFormatter={(v) => `≤ $${fmt(Number(v))}`} />
            <Legend />
            <Bar yAxisId="izq" dataKey="frecuencia" name="Frecuencia" fill="#A855F7" radius={[4, 4, 0, 0]} />
            <Line yAxisId="der" type="monotone" dataKey="frecuencia_acumulada_pct" name="Acumulada %" stroke="#5B18D9" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {markowitz && (
        <div className="card-premium p-6">
          <h2 className="font-bold text-brand-900 mb-1">Comparación con Markowitz</h2>
          <p className="text-xs text-slate-400 mb-3">{markowitz.nota}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={distribucion.map((d) => ({
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

      {/* ## Análisis estadístico ÚNICO de este formulario */}
      {(factorDominante || desviacionMarkowitz !== null) && (
        <div className="card-premium p-6 bg-gradient-to-br from-brand-50 to-white">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white text-sm">
              📐
            </span>
            <h2 className="font-bold text-brand-900">Análisis estadístico de tu propuesta</h2>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
            {propuesta.score != null && (
              <li>
                • Tu puntaje total fue <b className="text-brand-900">{propuesta.score}</b>, lo que te ubicó
                en el perfil <b className="capitalize text-brand-900">{propuesta.perfil}</b> según los umbrales
                versionados del cuestionario.
              </li>
            )}
            {factorDominante && (
              <li>
                • La respuesta con <b>mayor peso en tu score</b> fue "{factorDominante.pregunta}" →{" "}
                <b>{factorDominante.respuesta}</b> ({factorDominante.puntos} pts): {factorDominante.explicacion}
              </li>
            )}
            {factorConservador && factorConservador !== factorDominante && (
              <li>
                • Tu respuesta <b>más conservadora</b> fue "{factorConservador.pregunta}" →{" "}
                <b>{factorConservador.respuesta}</b> ({factorConservador.puntos} pts): {factorConservador.explicacion}
              </li>
            )}
            <li>
              • Según la simulación Monte Carlo, hay un <b className="text-brand-900">{probPerdida}%</b> de
              probabilidad de terminar con menos capital del que invertiste (${fmt(propuesta.proyeccion.monto_inicial)})
              al cabo de {propuesta.proyeccion.horizonte_meses} meses.
            </li>
            {desviacionMarkowitz !== null && (
              <li>
                • Tu asignación por reglas difiere en promedio <b className="text-brand-900">{desviacionMarkowitz.toFixed(1)} puntos porcentuales</b> por
                clase respecto a la cartera óptima de Markowitz — {desviacionMarkowitz < 5 ? "una coincidencia alta" : "una diferencia esperable, ya que las reglas priorizan simplicidad y transparencia sobre optimización pura"}.
              </li>
            )}
          </ul>
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
