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
import AnalisisEstadistico from "@/components/AnalisisEstadistico";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import { SkeletonGrid, SkeletonRow } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  AutopilotConfig,
  ClientRankingRow,
  CorrelationMatrix,
  HistoryItem,
  MarkowitzResult,
  PilotConfig,
  QualityReport,
  getAudit,
  getAutopilot,
  getCorrelacion,
  getHistory,
  getMarkowitz,
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
  const { mostrar } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [errorLogin, setErrorLogin] = useState("");
  const [vista, setVista] = useState<Vista>("dashboard");
  const [notifAbierta, setNotifAbierta] = useState(false);
  const [cargando, setCargando] = useState(true);

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
  // ## Confirmación visual antes de una decisión irreversible (aprobar/rechazar)
  const [confirmando, setConfirmando] = useState<"approve" | "reject" | null>(null);
  const [decidiendo, setDecidiendo] = useState(false);

  // ## Análisis estadístico completo del caso seleccionado (Markowitz + correlación)
  const [markowitzCaso, setMarkowitzCaso] = useState<MarkowitzResult | null>(null);
  const [correlacionCaso, setCorrelacionCaso] = useState<CorrelationMatrix | null>(null);

  useEffect(() => {
    if (!seleccionado) {
      setMarkowitzCaso(null);
      setCorrelacionCaso(null);
      return;
    }
    Promise.all([getMarkowitz(seleccionado.perfil.perfil), getCorrelacion()])
      .then(([mk, corr]) => {
        setMarkowitzCaso(mk);
        setCorrelacionCaso(corr);
      })
      .catch(() => {});
  }, [seleccionado?.client_id]);

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
    setCargando(false);
  }

  useEffect(() => {
    if (token) recargar(token).catch(() => setCargando(false));
  }, [token]);

  async function handleLogin() {
    setErrorLogin("");
    try {
      const r = await login(usuario, clave);
      setToken(r.token);
    } catch {
      setErrorLogin("Usuario o clave incorrectos. Verifica mayúsculas y vuelve a intentarlo.");
    }
  }

  const MENSAJE_DECISION: Record<string, string> = {
    approve: "Propuesta aprobada",
    edit: "Edición guardada",
    reject: "Propuesta rechazada",
  };

  async function decidir(proposalId: number, decision: "approve" | "edit" | "reject", distribucionEditada?: Record<string, number>, nombreCliente?: string) {
    if (!token) return;
    setDecidiendo(true);
    try {
      await sendDecision(token, proposalId, {
        decision,
        asesor: usuario || "operador",
        comentario: "",
        distribucion_editada: distribucionEditada,
      });
      setModoEdicion(false);
      setConfirmando(null);
      await recargar(token);
      mostrar(MENSAJE_DECISION[decision] ?? "Decisión registrada", "success", nombreCliente ? `Cliente: ${nombreCliente}. Queda en el historial de auditoría.` : undefined);
    } catch {
      mostrar("No se pudo registrar la decisión", "error", "Verifica tu conexión con el servidor e inténtalo de nuevo.");
    } finally {
      setDecidiendo(false);
    }
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

  // ## Resumen ejecutivo del Dashboard — derivado 100% de `historia`, ya cargada.
  const resumen = useMemo(() => {
    const confianzas = historia.filter((h) => h.propuesta).map((h) => h.propuesta!.confianza);
    return {
      pendientes: historia.filter((h) => h.revision.estado === "pendiente").length,
      aprobadas: historia.filter((h) => h.revision.estado === "aprobada").length,
      confianzaMedia: confianzas.length ? Math.round((confianzas.reduce((a, b) => a + b, 0) / confianzas.length) * 100) : null,
      recomendadas: historia.filter((h) => h.propuesta?.autopilot?.recomendado && h.revision.estado === "pendiente").length,
    };
  }, [historia]);

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
        {errorLogin && (
          <p className="text-xs text-red-600 mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
            ⚠️ {errorLogin}
          </p>
        )}
        <button onClick={handleLogin} className="btn-primary w-full">Entrar</button>
        <p className="text-[11px] text-slate-400 text-center mt-4 flex items-center justify-center gap-1.5">
          <span className="text-success-500">🔒</span> Acceso exclusivo para funcionarios autorizados
        </p>
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
              setConfirmando(null);
              setModoEdicion(false);
            }}
            aria-current={vista === n.id ? "page" : undefined}
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
                aria-label={`Notificaciones${pendientes.length > 0 ? `, ${pendientes.length} pendientes` : ""}`}
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
                        setConfirmando(null);
                        setModoEdicion(false);
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
        {vista === "dashboard" && !seleccionado && cargando && <SkeletonGrid n={6} />}

        {vista === "dashboard" && !seleccionado && !cargando && (
          <div className="space-y-4">
            {/* ## Resumen ejecutivo: centro de inteligencia financiera de un vistazo.
            ## Todo derivado de `historia`/`auditoria` ya cargados — cero llamadas nuevas. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card-premium p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Pendientes</p>
                <p className="text-2xl font-extrabold text-amber-500 mt-1">{resumen.pendientes}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">esperan decisión humana</p>
              </div>
              <div className="card-premium p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Aprobadas</p>
                <p className="text-2xl font-extrabold text-success-500 mt-1">{resumen.aprobadas}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">de {historia.length} clientes totales</p>
              </div>
              <div className="card-premium p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1">
                  Confianza media
                  <InfoTip texto="Promedio de la confianza bayesiana (Beta-Binomial) de todas las propuestas con confianza calculada. Más alto = el modelo está más seguro de esa clasificación de riesgo." />
                </p>
                <p className="text-2xl font-extrabold text-brand-700 mt-1">{resumen.confianzaMedia ?? "—"}%</p>
                <p className="text-[11px] text-slate-400 mt-0.5">across all proposals</p>
              </div>
              <div className="card-premium p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1">
                  🤖 Recomendadas
                  <InfoTip texto="Propuestas donde el Autopiloto detectó confianza alta y sin alertas de Cumplimiento. Solo es una sugerencia — nunca aprueba nada por sí solo." />
                </p>
                <p className="text-2xl font-extrabold text-brand-700 mt-1">{resumen.recomendadas}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">candidatas a revisión rápida</p>
              </div>
            </div>

            {/* ## Actividad reciente — últimas decisiones registradas (auditoría ya cargada) */}
            {auditoria.length > 0 && (
              <div className="card-premium p-4">
                <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-3">Actividad reciente</p>
                <ul className="space-y-2">
                  {[...auditoria]
                    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
                    .slice(0, 4)
                    .map((a) => (
                      <li key={a.id} className="flex items-center gap-2.5 text-xs">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.decision === "reject" ? "bg-red-400" : a.decision === "edit" ? "bg-accent" : "bg-success-500"}`} />
                        <span className="text-slate-500 truncate">
                          <b className="text-brand-800">{a.asesor}</b> {a.decision === "approve" ? "aprobó" : a.decision === "edit" ? "editó" : "rechazó"} la propuesta de{" "}
                          <b className="text-brand-800">{clienteMap.get(a.proposal_id) || `#${a.proposal_id}`}</b>
                        </span>
                        <span className="ml-auto text-slate-300 shrink-0">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString("es-EC") : ""}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

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

            {clientesFiltrados.length === 0 && (
              <EmptyState
                icono="🔍"
                titulo="No hay clientes que coincidan"
                texto={busqueda ? `Nadie coincide con "${busqueda}". Prueba con otro nombre o cambia el filtro de estado.` : "No hay clientes en este estado todavía. Prueba con otro filtro."}
                accion={
                  busqueda || filtroEstado !== "todos"
                    ? { label: "Limpiar filtros", onClick: () => { setBusqueda(""); setFiltroEstado("todos"); } }
                    : undefined
                }
              />
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesFiltrados.map((h) => {
                const nombre = h.cliente_nombre?.trim() || `Cliente Demo ${h.client_id}`;
                const confianzaPct = h.propuesta ? Math.round(h.propuesta.confianza * 100) : null;
                return (
                  <button
                    key={h.propuesta?.proposal_id ?? h.client_id}
                    onClick={() => {
                      setConfirmando(null);
                      setModoEdicion(false);
                      setSeleccionado(h);
                    }}
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
                    {h.propuesta?.autopilot?.recomendado && h.revision.estado === "pendiente" && (
                      <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-pill bg-brand-100 text-brand-700 mb-2">
                        🤖 Recomendado para revisión rápida
                      </span>
                    )}
                    <span className="text-xs font-bold text-brand-600 block">Ver propuesta →</span>
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
              <button
                onClick={() => {
                  setSeleccionado(null);
                  setConfirmando(null);
                  setModoEdicion(false);
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-800"
              >
                ← Volver al dashboard
              </button>

              {/* ## Resumen del cliente — glass + gradiente */}
              <div className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-deep bg-gradient-to-br from-brand-700 via-brand-600 to-secondary">
                <div className="pointer-events-none absolute -top-10 -right-8 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-white/70">Resumen del cliente</p>
                    <h2 className="text-2xl font-extrabold">{nombre}</h2>
                    <p className="text-sm text-white/80 capitalize mt-1 flex items-center gap-1.5">
                      Perfil {h.perfil.perfil} · Score {h.perfil.score} · Confianza {confianzaPct ?? "—"}%
                      <span className="[&_button]:bg-white/25 [&_button]:text-white [&_button:hover]:bg-white/40">
                        <InfoTip
                          label="¿Cómo se calculó la confianza?"
                          texto="Modelo bayesiano Beta-Binomial: parte de un prior neutral y se ajusta con cada decisión histórica de los asesores. Un % más alto significa que el sistema está más seguro de que este perfil de riesgo es correcto."
                        />
                      </span>
                    </p>
                  </div>
                  <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-pill bg-white/20 backdrop-blur-md border border-white/30`}>
                    {h.revision.estado}
                  </span>
                </div>
              </div>

              <div className="card-premium p-5">
                <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-2">🎯 Objetivo</p>
                <p className="text-sm text-slate-600">{objetivo ? objetivo.respuesta : "No especificado en el cuestionario."}</p>
              </div>

              {/* ## Análisis estadístico COMPLETO del caso — mismo panel que ve el
              ## cliente (barras, mapa de calor, velas, ojiva, Markowitz) + el
              ## detalle de las 10 respuestas, para una decisión más rigurosa. */}
              {h.propuesta && (
                <AnalisisEstadistico
                  perfil={h.perfil.perfil}
                  score={h.perfil.score}
                  influencias={h.perfil.influencias}
                  distribucion={distribucion}
                  proyeccion={h.propuesta.proyeccion}
                  markowitz={markowitzCaso}
                  correlacion={correlacionCaso}
                  explicacion={h.propuesta.explicacion}
                  panelCompleto
                />
              )}

              {/* ## Recomendación del Autopiloto — solo informativa */}
              {h.propuesta?.autopilot && h.revision.estado === "pendiente" && (
                <div
                  className={`text-sm rounded-2xl px-4 py-3 border ${
                    h.propuesta.autopilot.recomendado
                      ? "bg-brand-50 border-brand-200 text-brand-800"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  🤖 <b>{h.propuesta.autopilot.recomendado ? "Recomendación del Autopiloto:" : "Autopiloto:"}</b>{" "}
                  {h.propuesta.autopilot.motivo} La decisión final es tuya.
                </div>
              )}

              {/* ## Botones grandes de decisión — con confirmación visual antes de
              ## aprobar/rechazar (acciones que quedan en auditoría permanente). */}
              {h.revision.estado === "pendiente" && h.propuesta && (
                <div className="card-premium p-5">
                  {!modoEdicion && confirmando ? (
                    <div className="text-center space-y-3 animate-rise">
                      <p className="text-sm font-semibold text-brand-900">
                        {confirmando === "approve"
                          ? `¿Confirmas aprobar la propuesta de ${nombre}?`
                          : `¿Confirmas rechazar la propuesta de ${nombre}?`}
                      </p>
                      <p className="text-xs text-slate-400">Esta decisión queda registrada en el historial de auditoría, con tu usuario y la fecha.</p>
                      <div className="flex justify-center gap-3">
                        <button
                          disabled={decidiendo}
                          onClick={() => decidir(h.propuesta!.proposal_id, confirmando, undefined, nombre)}
                          className={`text-sm font-extrabold px-6 py-3 rounded-2xl text-white shadow-lift hover:-translate-y-0.5 transition-transform disabled:opacity-60 bg-gradient-to-b ${
                            confirmando === "approve" ? "from-success-400 to-success-500" : "from-red-400 to-red-500"
                          }`}
                        >
                          {decidiendo ? "Registrando…" : confirmando === "approve" ? "Sí, aprobar" : "Sí, rechazar"}
                        </button>
                        <button
                          disabled={decidiendo}
                          onClick={() => setConfirmando(null)}
                          className="text-sm font-bold px-6 py-3 rounded-2xl bg-slate-100 text-slate-500 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : !modoEdicion ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setConfirmando("approve")}
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
                        onClick={() => setConfirmando("reject")}
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
                      {(() => {
                        const suma = Object.values(distEditada).reduce((a, b) => a + b, 0);
                        const cuadra = Math.abs(suma - 100) < 0.1;
                        return (
                          <p className={`text-xs font-semibold ${cuadra ? "text-success-500" : "text-amber-600"}`}>
                            Suma actual: {suma.toFixed(1)}% {cuadra ? "✓ cuadra con 100%" : "— revisa antes de guardar, debería sumar 100%"}
                          </p>
                        );
                      })()}
                      <div className="flex gap-2">
                        <button
                          disabled={decidiendo}
                          onClick={() => decidir(h.propuesta!.proposal_id, "edit", distEditada, nombre)}
                          className="text-sm font-bold px-5 py-2.5 rounded-xl bg-brand-600 text-white disabled:opacity-60"
                        >
                          {decidiendo ? "Guardando…" : "Guardar edición"}
                        </button>
                        <button onClick={() => setModoEdicion(false)} disabled={decidiendo} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-slate-100 text-slate-500 disabled:opacity-60">
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
                  {cargando && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                  {!cargando &&
                    auditoriaFiltrada.map((a) => (
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
                </tbody>
              </table>
              {!cargando && auditoriaFiltrada.length === 0 && (
                <EmptyState
                  icono="🕒"
                  titulo="Sin registros de auditoría todavía"
                  texto={
                    buscHistorial || filtroHistorial !== "todos"
                      ? "Nada coincide con tu búsqueda o filtro actual."
                      : "Cuando un asesor apruebe, edite o rechace una propuesta, aparecerá aquí de forma permanente."
                  }
                  accion={
                    buscHistorial || filtroHistorial !== "todos"
                      ? { label: "Limpiar filtros", onClick: () => { setBuscHistorial(""); setFiltroHistorial("todos"); } }
                      : undefined
                  }
                />
              )}
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

        {/* ## ================= AUTOPILOTO (solo RECOMIENDA, nunca aprueba) ================= */}
        {vista === "autopiloto" && autopilotCfg && (
          <div className="space-y-4">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 max-w-xl">
              ⚠️ Requisito del track: el Autopiloto <b>nunca aprueba, edita ni rechaza</b> nada por sí
              solo. Solo marca qué propuestas son candidatas a revisión rápida — la decisión final
              siempre la toma un asesor humano haciendo clic en Aprobar, Editar o Rechazar.
            </p>
            <div className="card-premium p-5 max-w-md">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={autopilotCfg.enabled}
                  onChange={(e) => setAutopilot(token, { ...autopilotCfg, enabled: e.target.checked }).then(() => recargar(token))}
                />
                Activar recomendaciones automáticas
              </label>
              <label className="block mt-3 text-sm">
                Umbral de confianza para recomendar: {autopilotCfg.umbral}
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
              <p className="text-xs text-slate-400 mt-3">
                Cuando la confianza bayesiana de una propuesta supere este umbral y no haya alertas de
                Cumplimiento, aparecerá marcada como "recomendada" en el Dashboard — solo eso.
              </p>
            </div>
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
