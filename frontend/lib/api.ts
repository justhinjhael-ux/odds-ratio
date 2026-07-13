// ## ==========================================================================
// ## lib/api.ts — Cliente HTTP centralizado hacia el backend FastAPI
// ## Toda la comunicación con la API pasa por aquí: una sola fuente de verdad.
// ## La lógica de negocio vive en el backend (grafo LangGraph) — el frontend
// ## solo consume datos ya calculados (criterio #1: lógica separada de la UI).
// ## ==========================================================================

// ## URL base del backend: en local usa el puerto 8000; en Docker/nube se
// ## inyecta NEXT_PUBLIC_API_URL como variable de entorno en build time.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ## ---------- Tipos TypeScript (contratos espejo de schemas.py) ----------

export interface OpcionPregunta {
  texto: string;
  puntos: number;
  explicacion: string;
  segmento_saldo?: string;
}

export interface Pregunta {
  texto: string;
  opciones: Record<string, OpcionPregunta>;
}

export interface PreguntaOpcional {
  id: string;
  texto: string;
  placeholder: string;
}

export interface Questionnaire {
  version: string;
  preguntas: Record<string, Pregunta>;
  pregunta_opcional: PreguntaOpcional;
}

export interface RespuestaMeta {
  question_id: string;
  selected_option?: string;
  seconds_spent?: number;
  option_changes_count?: number;
  user_feedback?: string;
}

export interface TestMetadata {
  is_pilot_sample?: boolean;
  device?: string;
}

// ## Un punto del fan chart: percentiles del valor simulado del portafolio
export interface FanChartPoint {
  mes: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

// ## Un bin del histograma del valor final simulado (base de la ojiva)
export interface HistogramaBin {
  bin_inicio: number;
  bin_fin: number;
  frecuencia: number;
  frecuencia_acumulada_pct: number;
}

export interface Proyeccion {
  monto_inicial: number;
  horizonte_meses: number;
  retorno_mensual_esperado: number;
  volatilidad_mensual: number;
  fan_chart: FanChartPoint[];
  histograma_valor_final: HistogramaBin[];
  prob_perdida_capital_pct: number;
  n_simulaciones: number;
  modelo: string;
  disclaimer: string;
}

export interface CorrelationMatrix {
  clases: string[];
  matriz: number[][];
  version: string;
}

// ## Una clase de activo dentro de la distribución propuesta
export interface AllocationItem {
  clase: string;
  nombre: string;
  riesgo: string;
  porcentaje: number;
  instrumentos: { ticker: string; nombre: string; tipo: string }[];
}

// ## Forma que toma `distribucion` en una propuesta EDITADA por el asesor:
// ## el backend guarda el original + los % editados (ver AdvisorDecision).
export interface DistribucionEditada {
  original: AllocationItem[];
  editada_por_asesor: Record<string, number>;
}

// ## Propuesta completa que devuelve el grafo LangGraph tras el interrupt
export interface Proposal {
  proposal_id: number;
  client_id: number;
  thread_id?: string;
  perfil: string;
  confianza: number;
  score?: number | null;
  influencias?: { pregunta: string; respuesta: string; puntos: number; explicacion: string }[];
  distribucion: AllocationItem[] | DistribucionEditada;
  proyeccion: Proyeccion;
  explicacion: string;
  estado: string;
  guardrail_activado: boolean;
  alerta_cumplimiento?: { ok: boolean; alertas: any[] };
  autopilot_aplicado?: boolean;
}

// ## Normaliza `distribucion` a una lista siempre — si la propuesta fue
// ## editada por el asesor, usa los % editados sobre los mismos activos
// ## originales (nombre/riesgo/instrumentos no cambian, solo el %).
export function normalizarDistribucion(distribucion: AllocationItem[] | DistribucionEditada): AllocationItem[] {
  if (Array.isArray(distribucion)) return distribucion;
  return distribucion.original.map((item) => ({
    ...item,
    porcentaje: distribucion.editada_por_asesor[item.clase] ?? item.porcentaje,
  }));
}

export interface MarkowitzResult {
  perfil: string;
  pesos: Record<string, number>;
  retorno_mensual_esperado: number;
  volatilidad_mensual: number;
  ratio_retorno_riesgo: number;
  fraccion_riesgosa: number;
  version: string;
  nota: string;
}

export interface HistoryItem {
  client_id: number;
  cliente_nombre: string;
  perfil: {
    score: number;
    perfil: string;
    influencias: { pregunta: string; respuesta: string; puntos: number; explicacion: string }[];
    rules_version: string;
    estratos: Record<string, string>;
    es_muestra_piloto: boolean;
  };
  propuesta: {
    proposal_id: number;
    confianza: number;
    distribucion: AllocationItem[] | DistribucionEditada;
    proyeccion: Proyeccion;
    explicacion: string;
    created_at: string | null;
  } | null;
  revision: {
    estado: string;
    asesor: string | null;
    decision: string | null;
    comentario: string | null;
    created_at: string | null;
  };
}

export interface PilotConfig {
  enabled: boolean;
  sample_fraction: number;
}

export interface AutopilotConfig {
  enabled: boolean;
  umbral: number;
}

export interface CasoCritico {
  client_id: number;
  seconds_spent: number;
  option_changes_count: number;
  user_feedback: string;
  z_score: number;
}

export interface TiempoPregunta {
  question_id: string;
  n_muestras: number;
  tiempo_promedio_seg: number;
  desviacion_seg: number;
  vacilacion_promedio: number;
  casos_criticos: CasoCritico[];
}

export interface QualityReport {
  version: string;
  cronbach: { alfa: number | null; n_registros: number; interpretacion?: string; nota?: string };
  estratos: { n_total: number; distribucion: Record<string, Record<string, number>> };
  tiempos_por_pregunta: TiempoPregunta[];
  feedback: {
    por_pregunta: { question_id: string; client_id: number; texto: string }[];
    generales: { client_id: number; texto: string }[];
  };
}

export interface ClientRankingRow {
  client_id: number;
  nombre: string;
  perfil: string;
  confianza_media: number;
  theta_muestreado: number;
  retorno_esperado_perfil: number;
  score: number;
}

// ## ---------- Helper fetch tipado ----------
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detalle}`);
  }
  return res.json();
}

function authHeaders(token: string): HeadersInit {
  return { "X-Operator-Token": token };
}

// ## ---------- Perfilamiento (Historia 1) ----------
export const getQuestionnaire = () => request<Questionnaire>("/profiling/questionnaire");
export const getPilotStatus = () => request<PilotConfig>("/profiling/pilot-status");

// ## ---------- Propuestas (arranca el grafo) ----------
export interface CreateProposalInput {
  cliente: { nombre: string; email: string };
  respuestas: Record<string, string>;
  horizonte_meses?: number;
  monto_inicial?: number;
  respuestas_meta?: RespuestaMeta[];
  test_metadata?: TestMetadata;
  retroalimentacion_general?: string;
}

export const createProposal = (payload: CreateProposalInput) =>
  request<Proposal>("/proposals", { method: "POST", body: JSON.stringify(payload) });

export const getProposal = (id: number) => request<Proposal>(`/proposals/${id}`);

// ## ---------- Forecast / Markowitz ----------
export const getAssetClasses = () => request<{ clases: Record<string, any> }>("/forecast/asset-classes");
export const getMarkowitz = (perfil: string) => request<MarkowitzResult>(`/forecast/markowitz/${perfil}`);
export const getCorrelacion = () => request<CorrelationMatrix>("/forecast/correlacion");

// ## ---------- Panel Operativo (protegido) ----------
export const login = (usuario: string, clave: string) =>
  request<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, clave }),
  });

export const getPending = (token: string) =>
  request<any[]>("/review/pending", { headers: authHeaders(token) });

export const getHistory = (token: string) =>
  request<HistoryItem[]>("/review/history", { headers: authHeaders(token) });

export const getQualityReport = (token: string) =>
  request<QualityReport>("/review/quality-report", { headers: authHeaders(token) });

export const sendDecision = (
  token: string,
  proposalId: number,
  decision: { decision: string; asesor: string; comentario?: string; distribucion_editada?: Record<string, number> }
) =>
  request<any>(`/review/${proposalId}/decision`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(decision),
  });

export const getAudit = (token: string) =>
  request<any[]>("/review/audit", { headers: authHeaders(token) });

export const getAutopilot = (token: string) =>
  request<AutopilotConfig>("/autopilot", { headers: authHeaders(token) });

export const setAutopilot = (token: string, config: AutopilotConfig) =>
  request<AutopilotConfig>("/autopilot", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });

export const getPilotMode = (token: string) =>
  request<PilotConfig>("/pilot-mode", { headers: authHeaders(token) });

export const setPilotMode = (token: string, config: PilotConfig) =>
  request<PilotConfig>("/pilot-mode", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });

export const getRanking = (token: string) =>
  request<ClientRankingRow[]>("/clients/ranking", { headers: authHeaders(token) });

export const getChatLogs = (token: string) =>
  request<any[]>("/chat/logs", { headers: authHeaders(token) });

// ## ---------- Chat (ORAI, público) ----------
export const sendChatMessage = (sessionId: string, mensaje: string) =>
  request<{ respuesta: string; escalado: boolean; guardrail_activado: boolean }>("/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, mensaje }),
  });
