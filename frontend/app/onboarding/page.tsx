"use client";
// ## ==========================================================================
// ## app/onboarding/page.tsx — Cuestionario de perfilamiento (Historia 1).
// ## Modo Piloto (muestreo intencional): si la sesión cae en la fracción
// ## configurada, captura en silencio tiempo por pregunta + vacilación, y
// ## muestra un ícono discreto de feedback puntual. Nunca fuerza nada.
// ##
// ## NOTA DE DISEÑO: solo la CAPA VISUAL fue rediseñada (premium banking /
// ## glassmorphism). Ninguna lógica, estado, cálculo o llamada API cambió.
// ## ==========================================================================
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SkeletonLine } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  Questionnaire,
  RespuestaMeta,
  createProposal,
  getPilotStatus,
  getQuestionnaire,
} from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [preguntas, setPreguntas] = useState<Questionnaire | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [esPiloto, setEsPiloto] = useState(false);
  const [feedbackAbierto, setFeedbackAbierto] = useState<string | null>(null);
  const [feedbackPorPregunta, setFeedbackPorPregunta] = useState<Record<string, string>>({});
  const [retroGeneral, setRetroGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");

  // ## tracking silencioso: timestamp de entrada + conteo de cambios por pregunta
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const [cambios, setCambios] = useState<Record<string, number>>({});

  useEffect(() => {
    getQuestionnaire().then(setPreguntas).catch(() => setError("No se pudo cargar el cuestionario."));
    getPilotStatus()
      .then((cfg) => setEsPiloto(cfg.enabled && Math.random() < cfg.sample_fraction))
      .catch(() => setEsPiloto(false));
  }, []);

  const idsPreguntas = useMemo(() => (preguntas ? Object.keys(preguntas.preguntas) : []), [preguntas]);
  const completas = idsPreguntas.filter((id) => respuestas[id]).length;

  function responder(pid: string, opcionId: string) {
    setTimestamps((prev) => ({ ...prev, [pid]: prev[pid] ?? Date.now() }));
    setCambios((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + (respuestas[pid] ? 1 : 0) }));
    setRespuestas((prev) => ({ ...prev, [pid]: opcionId }));
  }

  function calcularRespuestasMeta(): RespuestaMeta[] {
    const ahora = Date.now();
    return idsPreguntas.map((pid) => ({
      question_id: pid,
      selected_option: respuestas[pid] ?? "",
      seconds_spent: timestamps[pid] ? (ahora - timestamps[pid]) / 1000 : 0,
      option_changes_count: cambios[pid] ?? 0,
      user_feedback: feedbackPorPregunta[pid] ?? "",
    }));
  }

  async function enviar() {
    if (!preguntas) return;
    if (completas < idsPreguntas.length) {
      setError("Responde todas las preguntas antes de continuar.");
      mostrar("Faltan respuestas", "error", `Te quedan ${idsPreguntas.length - completas} preguntas por responder.`);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const resultado = await createProposal({
        cliente: { nombre, email },
        respuestas,
        respuestas_meta: esPiloto ? calcularRespuestasMeta() : [],
        test_metadata: { is_pilot_sample: esPiloto, device: navigator.userAgent.slice(0, 60) },
        retroalimentacion_general: retroGeneral,
      });
      // ## Momento wow: breve celebración antes de pasar a la propuesta
      setExito(true);
      setTimeout(() => router.push(`/propuesta?id=${resultado.proposal_id}`), 900);
    } catch (e) {
      setError("No se pudo crear la propuesta. Verifica tu conexión e inténtalo de nuevo.");
      mostrar("No se pudo generar tu propuesta", "error", "Revisa tu conexión a internet e inténtalo de nuevo en unos segundos.");
      setEnviando(false);
    }
  }

  if (!preguntas) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <SkeletonLine width="220px" height="1.75rem" />
          <SkeletonLine width="280px" height="0.9rem" />
        </div>
        <div className="skeleton-block" style={{ width: "100%", height: "150px", borderRadius: "1.75rem" }} />
        <div className="skeleton-block" style={{ width: "100%", height: "70px", borderRadius: "1.75rem" }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="skeleton-block" key={i} style={{ width: "100%", height: "140px", borderRadius: "1.75rem" }} />
        ))}
        <p className="text-center text-xs text-slate-400">Cargando cuestionario seguro…</p>
      </div>
    );
  }

  const progreso = idsPreguntas.length ? Math.round((completas / idsPreguntas.length) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-rise">
      {/* ## Overlay de transición elegante mientras se genera la propuesta */}
      {enviando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 backdrop-blur-md" role="status" aria-live="polite">
          <div className="card-premium px-10 py-9 flex flex-col items-center gap-4 text-center animate-rise">
            {!exito ? (
              <>
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-brand-600 border-transparent animate-spin" />
                </div>
                <p className="font-bold text-brand-900 text-lg">Generando tu propuesta…</p>
                <p className="text-xs text-slate-500 max-w-[15rem] leading-relaxed">
                  Analizando tu perfil con reglas versionadas y modelos bayesianos
                </p>
              </>
            ) : (
              <>
                {/* ## Momento wow: celebración discreta al terminar */}
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-success-400 to-success-500 flex items-center justify-center text-white text-3xl animate-pop">
                  ✓
                </div>
                <p className="font-bold text-brand-900 text-lg">¡Perfil listo!</p>
                <p className="text-xs text-slate-500 max-w-[15rem] leading-relaxed">Llevándote a tu propuesta personalizada…</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ## Bienvenida personalizada */}
      <header className="text-center pt-2">
        <span className="inline-flex items-center gap-2 rounded-pill bg-white/60 backdrop-blur-md border border-white/70 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
          Perfil del Inversionista
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-brand-900 tracking-tight">
          Hola{nombre.trim() ? `, ${nombre.trim().split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          {idsPreguntas.length} preguntas evaluadas con reglas versionadas ({preguntas.version}).
          Cada respuesta influye de forma transparente en tu perfil.
        </p>
      </header>

      {/* ## Tarjeta elegante estilo Apple Wallet con el nombre del usuario */}
      <div className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-deep bg-gradient-to-br from-brand-600 via-brand-500 to-accent">
        <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-brand-950/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-xl font-bold">
            {(nombre.trim()[0] || "•").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/70">Inversionista</p>
            <p className="text-lg font-bold truncate">{nombre.trim() || "Tu nombre"}</p>
            <p className="text-xs text-white/70 truncate">{email.trim() || "tu@correo.com"}</p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-[11px] uppercase tracking-widest text-white/70">ODS Ratio</p>
            <p className="text-sm font-semibold">Robo-Advisory</p>
          </div>
        </div>
        <div className="relative mt-6 grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-white/80">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="¿Cómo te llamas?"
              className="mt-1 w-full rounded-xl bg-white/15 backdrop-blur-md border border-white/30 px-3 py-2 text-white placeholder-white/50 font-normal outline-none focus:border-white/70 transition-colors"
            />
          </label>
          <label className="text-xs font-semibold text-white/80">
            Correo
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 w-full rounded-xl bg-white/15 backdrop-blur-md border border-white/30 px-3 py-2 text-white placeholder-white/50 font-normal outline-none focus:border-white/70 transition-colors"
            />
          </label>
        </div>
      </div>

      {/* ## Indicador + barra de progreso animada (sticky) — responde "¿dónde estoy?" */}
      <div className="sticky top-3 z-30 card-premium px-5 py-3.5" role="status" aria-live="polite">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-brand-900">Progreso del cuestionario</span>
          <span className="font-bold text-brand-600">{completas}/{idsPreguntas.length} · {progreso}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-pill bg-brand-100 overflow-hidden">
          <div
            className="h-full rounded-pill bg-gradient-to-r from-brand-600 to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progreso}%` }}
          />
        </div>
        {progreso === 100 && (
          <p className="text-xs text-success-500 font-semibold mt-2 animate-rise">
            ✓ Todo listo — revisa tus respuestas y genera tu propuesta cuando quieras.
          </p>
        )}
      </div>

      {/* ## Preguntas en tarjetas modernas */}
      {idsPreguntas.map((pid, i) => {
        const pregunta = preguntas.preguntas[pid];
        const contestada = !!respuestas[pid];
        return (
          <div key={pid} className="card-premium p-6">
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                  contestada ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-500"
                }`}
              >
                {contestada ? "✓" : i + 1}
              </span>
              <p className="font-semibold text-brand-900 leading-snug pt-1">{pregunta.texto}</p>
              {esPiloto && (
                <button
                  type="button"
                  onClick={() => setFeedbackAbierto(feedbackAbierto === pid ? null : pid)}
                  className="ml-auto text-slate-300 hover:text-brand-500 text-sm shrink-0 pt-1"
                  title="¿Esta pregunta te pareció confusa?"
                >
                  💬
                </button>
              )}
            </div>
            {esPiloto && feedbackAbierto === pid && (
              <input
                placeholder="¿Algo confuso en esta pregunta? (opcional)"
                value={feedbackPorPregunta[pid] ?? ""}
                onChange={(e) => setFeedbackPorPregunta((prev) => ({ ...prev, [pid]: e.target.value }))}
                className="mt-3 w-full text-sm rounded-xl border border-brand-100 px-3 py-2"
              />
            )}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {Object.entries(pregunta.opciones).map(([oid, opcion]) => {
                const sel = respuestas[pid] === oid;
                return (
                  <button
                    key={oid}
                    type="button"
                    onClick={() => responder(pid, oid)}
                    aria-pressed={sel}
                    className={`text-left text-sm px-4 py-3.5 rounded-2xl border transition-all duration-200 ease-ios ${
                      sel
                        ? "border-brand-600 bg-gradient-to-br from-brand-50 to-white text-brand-900 font-semibold shadow-lift"
                        : "border-slate-200 bg-white/50 hover:border-brand-300 hover:-translate-y-0.5 text-slate-600"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          sel ? "border-brand-600 bg-brand-600" : "border-slate-300"
                        }`}
                      >
                        {sel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {opcion.texto}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* ## IA explicable: por qué esta respuesta influye en tu perfil — feedback inmediato */}
            {contestada && (
              <p className="text-xs text-brand-600 bg-brand-50/70 border border-brand-100 rounded-xl px-3.5 py-2.5 mt-3 leading-relaxed animate-rise">
                💡 {pregunta.opciones[respuestas[pid]]?.explicacion}
              </p>
            )}
          </div>
        );
      })}

      {/* ## Retroalimentación opcional */}
      <div className="card-premium p-6">
        <p className="font-semibold text-brand-900">{preguntas.pregunta_opcional.texto}</p>
        <textarea
          value={retroGeneral}
          onChange={(e) => setRetroGeneral(e.target.value)}
          placeholder={preguntas.pregunta_opcional.placeholder}
          className="mt-3 w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm"
          rows={3}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-rise" role="alert">
          <span className="shrink-0">⚠️</span>
          <div>
            <p className="font-semibold">{error}</p>
            <p className="text-xs text-red-500 mt-0.5">Nada se pierde: tus respuestas siguen aquí, solo corrige e inténtalo de nuevo.</p>
          </div>
        </div>
      )}

      {/* ## Botón grande */}
      <button
        onClick={enviar}
        disabled={enviando}
        className="btn-primary w-full text-base py-4 rounded-2xl disabled:opacity-50"
      >
        {enviando ? "Generando propuesta…" : `Generar mi propuesta · ${completas}/${idsPreguntas.length}`}
      </button>
    </div>
  );
}
