"use client";
// ## ==========================================================================
// ## app/asesor/page.tsx — Panel Operativo: dashboard tipo Stripe/Linear.
// ##
// ## NOTA DE DISEÑO: solo capa visual/estructural (sidebar, navbar, tarjetas,
// ## tabla premium, vista de revisión con línea de tiempo). Ningún endpoint,
// ## payload, cálculo ni llamada a la API fue modificado — mismos datos que
// ## ya traía recargar(): historia, calidad, autopilotCfg, pilotCfg, ranking,
// ## auditoria. sendDecision() se llama exactamente igual que antes.
// ## ==========================================================================
import { useEffect, useMemo, useState } from "react";
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
  normalizarDistribucion,
  sendDecision,
  setAutopilot,
  setPilotMode,
} from "@/lib/api";

type Vista = "dashboard" | "historial" | "ranking" | "calidad" | "autopiloto" | "piloto";

const ESTADO_ESTILO: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobada: "bg-success-400/20 text-success-600",
  rechazada: "bg-red-100 text-red-600",
  editada: "bg-accent/15 text-accent",
};

// ## Traduce el campo `decision` de un registro de auditoría (approve/edit/reject)
// ## al mismo vocabulario de `estado` (aprobada/editada/rechazada) para reusar ESTADO_ESTILO.
const DECISION_A_ESTADO: Record<string, string> = { approve: "aprobada", edit: "editada", reject: "rechazada" };

function buscarInfluencia(influencias: HistoryItem["perfil"]["influencias"], palabra: string) {
  return influencias.find((i) => i.pregunta.toLowerCase().includes(palabra));
}

export default function AsesorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [errorLogin, setErrorLogin] = useState("");
  const [vista, setVista] = useState<Vista>("dashboard");
  const [notifAbierta, setNotifAbierta] = useState(false);

  const [historia, setHistoria] = useState<HistoryItem[]>([]);
  const [calidad, setCalidad] = useState<QualityReport | null>(null);
  const [autopilotCfg, setAutopilotCfg] = useState<AutopilotConfig | null>(null);
  const [pilotCfg, setPilotCfg] = useState<PilotConfig | null>(null);
  const [ranking, setRanking] = useState<ClientRankingRow[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);

  // ## Dashboard: búsqueda + filtros + selección de cliente
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [seleccionado, setSeleccionado] = useState<HistoryItem | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [distEditada, setDistEditada] = useState<Record<string, number>>({});

  // ## Historial: búsqueda + filtro de estado
  const [buscHistorial, setBuscHistorial] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("todos");

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
    setSeleccionado((prev) => (prev ? h.find((x) => x.client_id === prev.client_id) ?? null : null));
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

  async function decidir(proposalId: number, decision: "approve" | "edit" | "reject", distribucionEditada?: Record<string, number>) {
    if (!token) return;
    await sendDecision(token, proposalId, {
      decision,
      asesor: usuario || "operador",
      comentario: "",
      distribucion_editada: distribucionEditada,
    });
    setModoEdicion(false);
    recargar(token);
  }

  const pendientes = historia.filter((h) => h.revision.estado === "pendiente");
  const clienteMap = useMemo(() => {
    const m = new Map<number, string>();
    historia.forEach((h) => {
      if (h.propuesta) m.set(h.propuesta.proposal_id, h.cliente_nombre?.trim() || `Cliente Demo ${h.client_id}`);
    });
    return m;
  }, [historia]);

  const clientesFiltrados = historia.filter((h) => {
    const nombre = (h.cliente_nombre || `Cliente Demo ${h.client_id}`).toLowerCase();
    if (busqueda && !nombre.includes(busqueda.toLowerCase())) return false;
    if (filtroEstado !== "todos" && h.revision.estado !== filtroEstado) return false;
    return true;
  });

  const auditoriaFiltrada = auditoria.filter((a) => {
    const nombre = (clienteMap.get(a.proposal_id) || "").toLowerCase();
    if (buscHistorial && !nombre.includes(buscHistorial.toLowerCase()) && !String(a.proposal_id).includes(buscHistorial)) return false;
    if (filtroHistorial !== "todos" && a.decision !== filtroHistorial) return false;
    return true;
  });

  if (!token) {
    return (
      <div className="max-w-sm mx-auto card-premium p-7 mt-16">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-accent flex items-center justify-center text-white text-base">
            🔐
          </span>
          <h1 className="font-extrabold text-brand-900 text-lg">Panel Operativo</h1>
        </div>
        <input
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full rounded-xl border border-brand-100 bg-white/70 px-3 py-2.5 text-sm mb-2.5"
        />
        <input
          placeholder="Clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full rounded-xl border border-brand-100 bg-white/70 px-3 py-2.5 text-sm mb-3"
        />
        {errorLogin && <p className="text-xs text-red-600 mb-2">{errorLogin}</p>}
        <button onClick={handleLogin} className="btn-primary w-full">Entrar</button>
      </div>
    );
  }

  const NAV: { id: Vista; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "historial", label: "Historial", icon: "🕒" },
    { id: "ranking", label: "Ranking clientes", icon: "📊" },
    { id: "calidad", label: "Calidad", icon: "📐" },
    { id: "autopiloto", label: "Autopiloto", icon: "🤖" },
    { id: "piloto", label: "Modo Piloto", icon: "🧪" },
  ];

  const TITULOS: Record<Vista, string> = {
    dashboard: "Dashboard de clientes",
    historial: "Historial de decisiones",
    ranking: "Ranking bayesiano de clientes",
    calidad: "Calidad del cuestionario",
    autopiloto: "Modo Autopiloto",
    piloto: "Modo Piloto",
  };

  return (
    <div className="flex gap-6 items-start -mt-8">
      {/* ## ---------- Sidebar ---------- */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 sticky top-20 card-premium p-4 gap-1">
        <div className="flex items-center gap-2 px-2 pb-4 mb-2 border-b border-white/60">
          <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-600 to-accent flex items-center justify-center text-white text-sm font-bold">
            OR
          </span>
          <div>
            <p className="text-sm font-extrabold text-brand-900 leading-tight">Odds Ratio</p>
            <p className="text-[10px] text-slate-400 leading-tight">Panel Operativo</p>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              setVista(n.id);
              setSeleccionado(null);
            }}
            className={`flex items-center gap-2.5 text-sm font-semibold px-3 py-2.5 rounded-xl text-left transition-all ${
              vista === n.id
                ? "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-lift"
                : "text-brand-700 hover:bg-brand-50"
            }`}
          >
            <span>{n.icon}</span>
            {n.label}
            {n.id === "dashboard" && pendientes.length > 0 && (
              <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-pill ${vista === n.id ? "bg-white/25" : "bg-amber-100 text-amber-700"}`}>
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-white/60 px-2">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-xs">👤</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-brand-900 truncate">{usuario || "operador"}</p>
              <p className="text-[10px] text-slate-400">Analista de inversión</p>
            </div>
          </div>
          <button onClick={() => setToken(null)} className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-red-500">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ## ---------- Contenido ---------- */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* ## Navbar superior */}
        <div className="flex flex-wrap items-center justify-between gap-3 card-premium px-5 py-3.5">
          <div>
            <h1 className="text-lg font-extrabold text-brand-900">{TITULOS[vista]}</h1>
            <p className="text-xs text-slate-400">Gestión manual: nada avanza ni se prioriza sin criterio humano.</p>
          </div>
          <div className="flex items-center gap-3">
            {vista === "dashboard" && !seleccionado && (
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="🔍 Buscar cliente…"
                className="text-sm rounded-xl border border-brand-100 bg-white/70 px-3.5 py-2 w-48"
              />
            )}
            <div className="relative">
              <button
                onClick={() => setNotifAbierta((v) => !v)}
                className="relative h-9 w-9 rounded-xl bg-white/70 border border-brand-100 flex items-center justify-center hover:-translate-y-0.5 transition-transform"
              >
                🔔
                {pendientes.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {pendientes.length}
                  </span>
                )}
              </button>
              {notifAbierta && (
                <div className="absolute right-0 mt-2 w-64 card-premium p-3 z-30 text-xs">
                  <p className="font-bold text-brand-900 mb-2">Pendientes de revisión</p>
                  {pendientes.length === 0 && <p className="text-slate-400">Sin pendientes 🎉</p>}
                  {pendientes.slice(0, 5).map((h) => (
                    <button
                      key={h.client_id}
                      onClick={() => {
                        setVista("dashboard");
                        setSeleccionado(h);
                        setNotifAbierta(false);
                      }}
                      className="block w-full text-left py-1.5 hover:text-brand-600"
                    >
                      • {h.cliente_nombre || `Cliente Demo ${h.client_id}`} — {h.perfil.perfil}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ## ================= DASHBOARD ================= */}
        {vista === "dashboard" && !seleccionado && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["todos", "pendiente", "aprobada", "rechazada", "editada"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroEstado(f)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-pill border capitalize transition-all ${
                    filtroEstado === f ? "bg-brand-600 text-white border-brand-600" : "border-white/70 bg-white/50 text-brand-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesFiltrados.map((h) => {
                const nombre = h.cliente_nombre?.trim() || `Cliente Demo ${h.client_id}`;
                const confianzaPct = h.propuesta ? Math.round(h.propuesta.confianza * 100) : null;
                return (
                  <button
                    key={h.propuesta?.proposal_id ?? h.client_id}
                    onClick={() => setSeleccionado(h)}
                    className="card-premium p-5 text-left hover:-translate-y-1 transition-transform"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-extrabold text-brand-900 leading-tight">{nombre}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-pill shrink-0 ${ESTADO_ESTILO[h.revision.estado] ?? "bg-slate-100 text-slate-500"}`}>
                        {h.revision.estado}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize mb-3">
                      Perfil {h.perfil.perfil} · Confianza {confianzaPct ?? "—"}%
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                      {h.propuesta?.explicacion || "Sin propuesta explicable disponible."}
                    </p>
                    <span className="text-xs font-bold text-brand-600">Ver propuesta →</span>
                  </button>
                );
              })}
              {clientesFiltrados.length === 0 && <p className="text-slate-400 text-sm">No hay clientes que coincidan.</p>}
            </div>
          </div>
        )}

        {/* ## ================= REVISIÓN DE PROPUESTA (VisionOS) ================= */}
        {vista === "dashboard" && seleccionado && (() => {
          const h = seleccionado;
          const nombre = h.cliente_nombre?.trim() || `Cliente Demo ${h.client_id}`;
          const confianzaPct = h.propuesta ? Math.round(h.propuesta.confianza * 100) : null;
          const objetivo = buscarInfluencia(h.perfil.influencias, "objetivo");
          const distribucion = h.propuesta ? normalizarDistribucion(h.propuesta.distribucion) : [];

          return (
            <div className="space-y-5 animate-rise">
              <button onClick={() => setSeleccionado(null)} className="text-xs font-bold text-brand-600 hover:text-brand-800">
                ← Volver al dashboard
              </button>

              {/* ## Resumen del cliente — glass + gradiente */}
              <div className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-deep bg-gradient-to-br from-brand-700 via-brand-600 to-secondary">
                <div className="pointer-events-none absolute -top-10 -right-8 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-white/70">Resumen del cliente</p>
                    <h2 className="text-2xl font-extrabold">{nombre}</h2>
                    <p className="text-sm text-white/80 capitalize mt-1">
                      Perfil {h.perfil.perfil} · Score {h.perfil.score} · Confianza {confianzaPct ?? "—"}%
                    </p>
                  </div>
                  <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-pill bg-white/20 backdrop-blur-md border border-white/30`}>
                    {h.revision.estado}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card-premium p-5">
                  <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-2">🎯 Objetivo</p>
                  <p className="text-sm text-slate-600">{objetivo ? objetivo.respuesta : "No especificado en el cuestionario."}</p>
                </div>
                <div className="card-premium p-5">
                  <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-2">📈 Portafolio propuesto</p>
                  <div className="flex flex-wrap gap-1.5">
                    {distribucion.map((d) => (
                      <span key={d.clase} className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-brand-100 text-brand-700">
                        {d.nombre}: {d.porcentaje}%
                      </span>
                    ))}
                    {distribucion.length === 0 && <span className="text-xs text-slate-400">Sin propuesta generada.</span>}
                  </div>
                </div>
              </div>

              <div className="card-premium p-5">
                <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-2">✨ Justificación IA</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {h.propuesta?.explicacion || "Sin explicación disponible."}
                </p>
              </div>

              {/* ## Botones grandes de decisión */}
              {h.revision.estado === "pendiente" && h.propuesta && (
                <div className="card-premium p-5">
                  {!modoEdicion ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => decidir(h.propuesta!.proposal_id, "approve")}
                        className="flex-1 min-w-[140px] text-sm font-extrabold px-5 py-4 rounded-2xl bg-gradient-to-b from-success-400 to-success-500 text-white shadow-lift hover:-translate-y-0.5 transition-transform"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() => {
                          setDistEditada(Object.fromEntries(distribucion.map((d) => [d.clase, d.porcentaje])));
                          setModoEdicion(true);
                        }}
                        className="flex-1 min-w-[140px] text-sm font-extrabold px-5 py-4 rounded-2xl bg-gradient-to-b from-accent to-brand-600 text-white shadow-lift hover:-translate-y-0.5 transition-transform"
                      >
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => decidir(h.propuesta!.proposal_id, "reject")}
                        className="flex-1 min-w-[140px] text-sm font-extrabold px-5 py-4 rounded-2xl bg-gradient-to-b from-red-400 to-red-500 text-white shadow-lift hover:-translate-y-0.5 transition-transform"
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide">Editar distribución (%)</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {distribucion.map((d) => (
                          <label key={d.clase} className="text-xs font-semibold text-brand-800">
                            {d.nombre}
                            <input
                              type="number"
                              value={distEditada[d.clase] ?? d.porcentaje}
                              onChange={(e) => setDistEditada((prev) => ({ ...prev, [d.clase]: Number(e.target.value) }))}
                              className="mt-1 w-full rounded-xl border border-brand-100 px-3 py-2 font-normal"
                            />
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        Suma actual: {Object.values(distEditada).reduce((a, b) => a + b, 0).toFixed(1)}%
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => decidir(h.propuesta!.proposal_id, "edit", distEditada)}
                          className="text-sm font-bold px-5 py-2.5 rounded-xl bg-brand-600 text-white"
                        >
                          Guardar edición
                        </button>
                        <button onClick={() => setModoEdicion(false)} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-slate-100 text-slate-500">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ## Línea de tiempo */}
              <div className="card-premium p-5">
                <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-4">Línea de tiempo</p>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500 mt-1 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-brand-900">Propuesta creada</p>
                      <p className="text-xs text-slate-400">
                        {h.propuesta?.created_at ? new Date(h.propuesta.created_at).toLocaleString("es-EC") : "—"}
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent mt-1 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-brand-900">Modelos aplicados</p>
                      <p className="text-xs text-slate-400">Reglas {h.perfil.rules_version} · confianza bayesiana {confianzaPct ?? "—"}%</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${h.revision.estado === "pendiente" ? "bg-amber-400 animate-pulse" : "bg-success-500"}`} />
                    <div className="text-sm">
                      <p className="font-semibold text-brand-900">Revisión — {h.revision.estado}</p>
                      <p className="text-xs text-slate-400">
                        {h.revision.asesor ? `Responsable: ${h.revision.asesor}` : "Esperando decisión humana"}
                        {h.revision.created_at && ` · ${new Date(h.revision.created_at).toLocaleString("es-EC")}`}
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          );
        })()}

        {/* ## ================= HISTORIAL (tabla premium) ================= */}
        {vista === "historial" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center card-premium px-4 py-3">
              <input
                value={buscHistorial}
                onChange={(e) => setBuscHistorial(e.target.value)}
                placeholder="🔍 Buscar cliente o # propuesta…"
                className="text-sm rounded-xl border border-brand-100 bg-white/70 px-3.5 py-2 flex-1 min-w-[180px]"
              />
              {["todos", "approve", "edit", "reject"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroHistorial(f)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-pill border capitalize transition-all ${
                    filtroHistorial === f ? "bg-brand-600 text-white border-brand-600" : "border-white/70 bg-white/50 text-brand-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="card-premium overflow-x-auto p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Versión</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Asesor</th>
                    <th className="px-4 py-3">Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriaFiltrada.map((a) => (
                    <tr key={a.id} className="border-t border-white/60 hover:bg-brand-50/60 hover:-translate-y-0 transition-colors">
                      <td className="px-4 py-3 font-semibold text-brand-900 whitespace-nowrap">
                        {clienteMap.get(a.proposal_id) || `Propuesta #${a.proposal_id}`}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {a.rules_version} / {a.posterior_version}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-pill ${ESTADO_ESTILO[DECISION_A_ESTADO[a.decision] ?? ""] ?? "bg-slate-100 text-slate-500"}`}>
                          {a.decision}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{a.asesor}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[240px] truncate">{a.comentario || "—"}</td>
                    </tr>
                  ))}
                  {auditoriaFiltrada.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                        Sin registros de auditoría todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ## ================= RANKING ================= */}
        {vista === "ranking" && (
          <div className="card-premium p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-700">
                  <th className="pr-4 py-2">Cliente</th>
                  <th className="pr-4 py-2">Perfil</th>
                  <th className="pr-4 py-2">Confianza</th>
                  <th className="py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.client_id} className="border-t border-white/60 hover:bg-brand-50/60 transition-colors">
                    <td className="py-2 pr-4">{r.nombre || `#${r.client_id}`}</td>
                    <td className="pr-4 capitalize">{r.perfil}</td>
                    <td className="pr-4">{Math.round(r.confianza_media * 100)}%</td>
                    <td>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ## ================= CALIDAD ================= */}
        {vista === "calidad" && calidad && (
          <div className="space-y-4">
            <div className="card-premium p-5">
              <p className="font-bold text-brand-900">Alfa de Cronbach</p>
              <p className="text-2xl font-extrabold text-brand-700">{calidad.cronbach.alfa ?? "—"}</p>
              <p className="text-xs text-slate-400">{calidad.cronbach.interpretacion ?? calidad.cronbach.nota}</p>
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

        {/* ## ================= AUTOPILOTO ================= */}
        {vista === "autopiloto" && autopilotCfg && (
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

        {/* ## ================= MODO PILOTO ================= */}
        {vista === "piloto" && pilotCfg && (
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
      </div>
    </div>
  );
}
