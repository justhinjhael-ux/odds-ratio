"use client";
// ## ==========================================================================
// ## app/onboarding/page.tsx — Cuestionario de perfilamiento (Historia 1).
// ## Modo Piloto (muestreo intencional): si la sesión cae en la fracción
// ## configurada, captura en silencio tiempo por pregunta + vacilación, y
// ## muestra un ícono discreto de feedback puntual. Nunca fuerza nada.
// ## ==========================================================================
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Questionnaire,
  RespuestaMeta,
  createProposal,
  getPilotStatus,
  getQuestionnaire,
} from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [preguntas, setPreguntas] = useState<Questionnaire | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [esPiloto, setEsPiloto] = useState(false);
  const [feedbackAbierto, setFeedbackAbierto] = useState<string | null>(null);
  const [feedbackPorPregunta, setFeedbackPorPregunta] = useState<Record<string, string>>({});
  const [retroGeneral, setRetroGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);
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
      router.push(`/propuesta?id=${resultado.proposal_id}`);
    } catch (e) {
      setError("No se pudo crear la propuesta. Verifica el backend e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!preguntas) {
    return <p className="text-center text-slate-500 py-20">Cargando cuestionario…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Cuéntanos sobre ti</h1>
        <p className="text-sm text-slate-500 mt-1">
          {idsPreguntas.length} preguntas evaluadas con reglas versionadas ({preguntas.version}), más
          una pregunta opcional de retroalimentación. Cada respuesta influye de forma transparente.
        </p>
      </div>

      <div className="card-premium p-5 grid sm:grid-cols-2 gap-4">
        <label className="text-sm font-semibold text-brand-800">
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-brand-800">
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal"
          />
        </label>
      </div>

      {idsPreguntas.map((pid) => {
        const pregunta = preguntas.preguntas[pid];
        return (
          <div key={pid} className="card-premium p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-brand-900">{pregunta.texto}</p>
              {esPiloto && (
                <button
                  type="button"
                  onClick={() => setFeedbackAbierto(feedbackAbierto === pid ? null : pid)}
                  className="text-slate-300 hover:text-brand-500 text-sm shrink-0"
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
                className="mt-2 w-full text-sm rounded-lg border border-brand-100 px-3 py-1.5"
              />
            )}
            <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
              {Object.entries(pregunta.opciones).map(([oid, opcion]) => (
                <button
                  key={oid}
                  type="button"
                  onClick={() => responder(pid, oid)}
                  className={`text-left text-sm px-3.5 py-2.5 rounded-xl border transition-colors ${
                    respuestas[pid] === oid
                      ? "border-brand-600 bg-brand-50 text-brand-900 font-semibold"
                      : "border-slate-200 hover:border-brand-300 text-slate-600"
                  }`}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="card-premium p-5">
        <p className="font-semibold text-brand-900">{preguntas.pregunta_opcional.texto}</p>
        <textarea
          value={retroGeneral}
          onChange={(e) => setRetroGeneral(e.target.value)}
          placeholder={preguntas.pregunta_opcional.placeholder}
          className="mt-2 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={enviar} disabled={enviando} className="btn-primary w-full disabled:opacity-50">
        {enviando ? "Generando propuesta…" : `Generar mi propuesta (${completas}/${idsPreguntas.length})`}
      </button>
    </div>
  );
}
