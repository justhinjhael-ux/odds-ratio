"use client";
// ## ==========================================================================
// ## app/asesor/page.tsx — Panel Operativo (solo funcionarios autenticados).
// ## Las 3 Historias por cliente, calidad del cuestionario, Modo Autopiloto,
// ## Modo Piloto, ranking bayesiano y auditoría append-only.
// ## ==========================================================================
import { useEffect, useState } from "react";
import {
  AutopilotConfig,
  ClientRankingRow,
  HistoryItem,
  PilotConfig,
  QualityReport,
  getAudit,
  getAutopilot,
  getHistory,
  getPilotMode,
  getQualityReport,
  getRanking,
  login,
  sendDecision,
  setAutopilot,
  setPilotMode,
} from "@/lib/api";

type Tab = "historia" | "calidad" | "autopiloto" | "piloto" | "ranking" | "auditoria";

export default function AsesorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [errorLogin, setErrorLogin] = useState("");
  const [tab, setTab] = useState<Tab>("historia");

  const [historia, setHistoria] = useState<HistoryItem[]>([]);
  const [calidad, setCalidad] = useState<QualityReport | null>(null);
  const [autopilotCfg, setAutopilotCfg] = useState<AutopilotConfig | null>(null);
  const [pilotCfg, setPilotCfg] = useState<PilotConfig | null>(null);
  const [ranking, setRanking] = useState<ClientRankingRow[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);

  async function recargar(t: string) {
    const [h, c, a, p, r, au] = await Promise.all([
      getHistory(t),
      getQualityReport(t),
      getAutopilot(t),
      getPilotMode(t),
      getRanking(t),
      getAudit(t),
    ]);
    setHistoria(h);
    setCalidad(c);
    setAutopilotCfg(a);
    setPilotCfg(p);
    setRanking(r);
    setAuditoria(au);
  }

  useEffect(() => {
    if (token) recargar(token).catch(() => {});
  }, [token]);

  async function handleLogin() {
    setErrorLogin("");
    try {
      const r = await login(usuario, clave);
      setToken(r.token);
    } catch {
      setErrorLogin("Usuario o clave incorrectos.");
    }
  }

  async function decidir(proposalId: number, decision: "approve" | "edit" | "reject") {
    if (!token) return;
    await sendDecision(token, proposalId, { decision, asesor: usuario || "operador", comentario: "" });
    recargar(token);
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto card-premium p-6 mt-16">
        <h1 className="font-bold text-brand-900 text-lg mb-4">Panel Operativo</h1>
        <input
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm mb-2"
        />
        <input
          placeholder="Clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm mb-3"
        />
        {errorLogin && <p className="text-xs text-red-600 mb-2">{errorLogin}</p>}
        <button onClick={handleLogin} className="btn-primary w-full">Entrar</button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "historia", label: "📋 Historias" },
    { id: "calidad", label: "📐 Calidad" },
    { id: "autopiloto", label: "🤖 Autopiloto" },
    { id: "piloto", label: "🧪 Modo Piloto" },
    { id: "ranking", label: "📊 Ranking" },
    { id: "auditoria", label: "🔒 Auditoría" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-pill border ${
              tab === t.id ? "bg-brand-600 text-white border-brand-600" : "border-brand-100 text-brand-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "historia" && (
        <div className="space-y-4">
          {historia.map((h) => (
            <details key={h.propuesta?.proposal_id ?? h.client_id} className="card-premium p-5">
              <summary className="cursor-pointer font-semibold text-brand-900">
                Cliente #{h.client_id} — perfil {h.perfil.perfil} — {h.revision.estado}
                {h.perfil.es_muestra_piloto && <span className="ml-2 text-xs text-brand-500">(piloto)</span>}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="font-bold text-brand-700">Historia 1 — Perfil transparente</p>
                  <p className="text-slate-500">
                    Score {h.perfil.score} · reglas {h.perfil.rules_version} · estratos:{" "}
                    {Object.entries(h.perfil.estratos).map(([k, v]) => `${k}=${v}`).join(", ")}
                  </p>
                </div>
                {h.propuesta && (
                  <div>
                    <p className="font-bold text-brand-700">Historia 2 — Propuesta explicable</p>
                    <p className="text-slate-500">{h.propuesta.explicacion}</p>
                  </div>
                )}
                <div>
                  <p className="font-bold text-brand-700">Historia 3 — Revisión</p>
                  <p className="text-slate-500">
                    Estado: {h.revision.estado}
                    {h.revision.asesor && ` · asesor: ${h.revision.asesor}`}
                  </p>
                  {h.revision.estado === "pendiente" && h.propuesta && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => decidir(h.propuesta!.proposal_id, "approve")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-success-400/20 text-success-500">
                        Aprobar
                      </button>
                      <button onClick={() => decidir(h.propuesta!.proposal_id, "reject")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-600">
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </details>
          ))}
          {historia.length === 0 && <p className="text-slate-400 text-sm">Aún no hay propuestas.</p>}
        </div>
      )}

      {tab === "calidad" && calidad && (
        <div className="space-y-4">
          <div className="card-premium p-5">
            <p className="font-bold text-brand-900">Alfa de Cronbach</p>
            <p className="text-2xl font-extrabold text-brand-700">
              {calidad.cronbach.alfa ?? "—"}
            </p>
            <p className="text-xs text-slate-400">
              {calidad.cronbach.interpretacion ?? calidad.cronbach.nota}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="font-bold text-brand-900 mb-2">Estratos (n={calidad.estratos.n_total})</p>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(calidad.estratos.distribucion).map(([grupo, valores]) => (
                <div key={grupo}>
                  <p className="font-semibold text-brand-700">{grupo}</p>
                  {Object.entries(valores).map(([k, v]) => (
                    <p key={k} className="text-slate-500">{k}: {v}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="card-premium p-5">
            <p className="font-bold text-brand-900 mb-2">Tiempos por pregunta (Modo Piloto)</p>
            {calidad.tiempos_por_pregunta.map((t) => (
              <p key={t.question_id} className="text-xs text-slate-500">
                {t.question_id}: {t.tiempo_promedio_seg}s promedio, {t.casos_criticos.length} casos críticos
              </p>
            ))}
          </div>
        </div>
      )}

      {tab === "autopiloto" && autopilotCfg && (
        <div className="card-premium p-5 max-w-md">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={autopilotCfg.enabled}
              onChange={(e) => setAutopilot(token, { ...autopilotCfg, enabled: e.target.checked }).then(() => recargar(token))}
            />
            Activar Modo Autopiloto
          </label>
          <label className="block mt-3 text-sm">
            Umbral de confianza: {autopilotCfg.umbral}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={autopilotCfg.umbral}
              onChange={(e) => setAutopilot(token, { ...autopilotCfg, umbral: Number(e.target.value) }).then(() => recargar(token))}
              className="w-full"
            />
          </label>
        </div>
      )}

      {tab === "piloto" && pilotCfg && (
        <div className="card-premium p-5 max-w-md">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={pilotCfg.enabled}
              onChange={(e) => setPilotMode(token, { ...pilotCfg, enabled: e.target.checked }).then(() => recargar(token))}
            />
            Activar Modo Piloto (muestreo intencional)
          </label>
          <label className="block mt-3 text-sm">
            Fracción de sesiones: {pilotCfg.sample_fraction}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={pilotCfg.sample_fraction}
              onChange={(e) => setPilotMode(token, { ...pilotCfg, sample_fraction: Number(e.target.value) }).then(() => recargar(token))}
              className="w-full"
            />
          </label>
        </div>
      )}

      {tab === "ranking" && (
        <div className="card-premium p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-700">
                <th className="pr-4">Cliente</th>
                <th className="pr-4">Perfil</th>
                <th className="pr-4">Confianza</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.client_id} className="border-t border-brand-50">
                  <td className="py-1.5 pr-4">{r.nombre || `#${r.client_id}`}</td>
                  <td className="pr-4 capitalize">{r.perfil}</td>
                  <td className="pr-4">{Math.round(r.confianza_media * 100)}%</td>
                  <td>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "auditoria" && (
        <div className="space-y-2">
          {auditoria.map((a) => (
            <div key={a.id} className="card-premium p-4 text-sm">
              <p className="font-semibold text-brand-900">
                Propuesta #{a.proposal_id} — {a.decision} por {a.asesor}
              </p>
              <p className="text-xs text-slate-400">
                reglas {a.rules_version} · posterior {a.posterior_version} · {a.created_at}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
