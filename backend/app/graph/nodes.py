"""Nodos del grafo LangGraph — Odds Ratio.

Flujo: perfilamiento → posterior_bayesiano → generar_propuesta →
       proyectar_series_tiempo → cumplimiento → explicacion_llm →
       [INTERRUPT: revisión humana] → auditoria

PRINCIPIO ANTIALUCINACIÓN (criterio #3, documentado también en
DOCUMENTO_EXPLICATIVO.md):
  * Todo número (score, perfil, %, proyecciones) sale de reglas determinísticas
    o modelos bayesianos versionados — NUNCA del LLM.
  * El nodo explicacion_llm recibe un JSON de SOLO LECTURA y su salida se
    valida: si contiene cifras ausentes del JSON, se descarta y se usa la
    plantilla determinística (guardrail activo, no solo prompt).
"""
import json
import logging
import re

from app.bayes import returns_forecast, risk_posterior
from app.data.fictitious_provider import data_provider
from app.database import SessionLocal
from app.graph.state import AdvisoryState
from app.llm.provider import MockLLMProvider, get_llm_provider
from app.rules import rules_engine
from app.workflows.cumplimiento_workflow import check_concentration

logger = logging.getLogger("odds-ratio.graph")


# ---------------------------------------------------------------------------
# Nodo 1 — PERFILAMIENTO (reglas determinísticas versionadas, Historia 1)
# ---------------------------------------------------------------------------
def nodo_perfilamiento(state: AdvisoryState) -> dict:
    resultado = rules_engine.evaluate_profile(state["respuestas"])
    return {"perfil_reglas": resultado}


# ---------------------------------------------------------------------------
# Nodo 2 — POSTERIOR BAYESIANO (Beta-Binomial con histórico del cliente)
# ---------------------------------------------------------------------------
def nodo_posterior_bayesiano(state: AdvisoryState) -> dict:
    perfil = state["perfil_reglas"]["perfil"]
    db = SessionLocal()
    try:
        post = risk_posterior.get_or_create_posterior(db, state["client_id"], perfil)
        resumen = risk_posterior.posterior_summary(post)
        db.commit()
    finally:
        db.close()
    return {
        "posterior": resumen,
        "perfil_final": perfil,
        "confianza": resumen["confianza"],
    }


# ---------------------------------------------------------------------------
# Nodo 3 — GENERAR PROPUESTA (catálogo ficticio + asignación por perfil)
# ---------------------------------------------------------------------------
def nodo_generar_propuesta(state: AdvisoryState) -> dict:
    perfil = state["perfil_final"]
    asignacion = rules_engine.target_allocation(perfil)
    catalogo = data_provider.get_catalog()["clases"]

    distribucion = []
    for clase, pct in asignacion.items():
        info = catalogo.get(clase, {})
        distribucion.append(
            {
                "clase": clase,
                "nombre": info.get("nombre", clase),
                "riesgo": info.get("riesgo", "n/d"),
                "porcentaje": pct,
                "instrumentos": info.get("instrumentos", []),
            }
        )
    return {
        "propuesta": {
            "perfil": perfil,
            "distribucion": distribucion,
            "rules_version": state["perfil_reglas"]["rules_version"],
        }
    }


# ---------------------------------------------------------------------------
# Nodo 4 — PROYECTAR SERIES DE TIEMPO (fan chart Normal-Normal, Historia 2)
# ---------------------------------------------------------------------------
def nodo_proyectar_series_tiempo(state: AdvisoryState) -> dict:
    pesos = {
        item["clase"]: item["porcentaje"]
        for item in state["propuesta"]["distribucion"]
    }
    proyeccion = returns_forecast.forecast_portfolio(
        distribucion=pesos,
        horizonte_meses=state.get("horizonte_meses", 60),
        monto_inicial=state.get("monto_inicial", 10_000.0),
    )
    return {"proyeccion": proyeccion}


# ---------------------------------------------------------------------------
# Nodo 5 — CUMPLIMIENTO/RIESGOS (workflow departamental 2 — SIMULADO)
# Marca alertas de concentración. NUNCA bloquea ni ejecuta nada (regla track).
# ---------------------------------------------------------------------------
def nodo_cumplimiento(state: AdvisoryState) -> dict:
    pesos = {
        item["clase"]: item["porcentaje"]
        for item in state["propuesta"]["distribucion"]
    }
    alerta = check_concentration(pesos)
    return {"alerta_cumplimiento": alerta}


# ---------------------------------------------------------------------------
# Nodo 6 — EXPLICACIÓN LLM (Gemini) con GUARDRAIL ANTIALUCINACIÓN
# ---------------------------------------------------------------------------
PROMPT_EXPLICACION = """Eres el asistente de comunicación de un robo-advisor regulado.
Tu ÚNICA tarea es redactar en español claro y profesional una explicación de la
propuesta de inversión usando EXCLUSIVAMENTE los datos del bloque <DATOS>.

REGLAS ESTRICTAS (violarlas invalida tu respuesta):
1. NO inventes cifras, porcentajes ni montos: usa solo los números del JSON.
2. NO agregues instrumentos ni clases de activo fuera de las listadas.
3. NO prometas rentabilidad: describe las proyecciones como simulaciones ilustrativas.
4. Menciona que un asesor humano autorizado revisará la propuesta antes de cualquier acción.
5. Máximo 180 palabras, tono cercano pero profesional.

<DATOS>
{datos_json}
</DATOS>
"""


def _extraer_numeros(texto: str) -> set[float]:
    """Extrae todos los números de un texto (soporta 1,234.56 y 12%)."""
    crudos = re.findall(r"-?\d[\d,]*\.?\d*", texto)
    numeros = set()
    for c in crudos:
        try:
            numeros.add(float(c.replace(",", "")))
        except ValueError:
            continue
    return numeros


def _numeros_permitidos(datos: dict) -> set[float]:
    """Todos los números presentes en el JSON de entrada (+ triviales 0/1/100)."""
    permitidos = {0.0, 1.0, 100.0}

    def _walk(obj):
        if isinstance(obj, dict):
            for v in obj.values():
                _walk(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                _walk(v)
        elif isinstance(obj, bool):
            pass
        elif isinstance(obj, (int, float)):
            permitidos.add(round(float(obj), 4))
            # variantes de redondeo que un redactor usaría legítimamente
            permitidos.add(round(float(obj), 2))
            permitidos.add(round(float(obj), 1))
            permitidos.add(round(float(obj)))

    _walk(datos)
    return permitidos


def validar_consistencia_numerica(texto: str, datos: dict) -> tuple[bool, list[float]]:
    """True si TODOS los números del texto existen en el JSON de entrada.

    Este es el guardrail central antialucinación: no confiamos en el prompt,
    verificamos la salida. Tolerancia por redondeo a 2 decimales.
    """
    permitidos = _numeros_permitidos(datos)
    extranos = []
    for num in _extraer_numeros(texto):
        candidatos = {round(num, 4), round(num, 2), round(num, 1), round(num)}
        if not (candidatos & permitidos):
            extranos.append(num)
    return (len(extranos) == 0, extranos)


def _resumen_para_llm(state: AdvisoryState) -> dict:
    """JSON de SOLO LECTURA que recibe el LLM — nada más entra al prompt."""
    fan = state["proyeccion"]["fan_chart"]
    ultimo = fan[-1] if fan else {}
    return {
        "perfil": state["perfil_final"],
        "confianza": state["confianza"],
        "horizonte_meses": state.get("horizonte_meses", 60),
        "monto_inicial": state.get("monto_inicial", 10_000.0),
        "distribucion": [
            {
                "clase": i["clase"],
                "nombre": i["nombre"],
                "porcentaje": i["porcentaje"],
            }
            for i in state["propuesta"]["distribucion"]
        ],
        "proyeccion_resumen": {
            "p05_final": ultimo.get("p05"),
            "p50_final": ultimo.get("p50"),
            "p95_final": ultimo.get("p95"),
        },
        "alertas_cumplimiento": state.get("alerta_cumplimiento", {}).get("alertas", []),
    }


def nodo_explicacion_llm(state: AdvisoryState) -> dict:
    provider = get_llm_provider()
    datos = _resumen_para_llm(state)
    prompt = PROMPT_EXPLICACION.format(
        datos_json=json.dumps(datos, ensure_ascii=False, indent=2)
    )
    texto = provider.generate(prompt)

    ok, extranos = validar_consistencia_numerica(texto, datos)
    guardrail = False
    if not ok:
        # GUARDRAIL: la salida del LLM contiene cifras que no están en el JSON.
        # Se descarta y se usa la plantilla determinística del mock (fiel por
        # construcción). Queda registrado para auditoría.
        logger.warning(
            "Guardrail antialucinación activado — números no permitidos: %s", extranos
        )
        texto = MockLLMProvider().generate(prompt)
        guardrail = True

    return {
        "explicacion": texto,
        "guardrail_activado": guardrail,
        "llm_provider": provider.name,
    }


# ---------------------------------------------------------------------------
# Nodo 7 — REVISIÓN HUMANA (Historia 3)
# El grafo se INTERRUMPE ANTES de este nodo (interrupt_before en build_graph).
# Solo se ejecuta cuando el asesor envía su decisión vía POST /review/.../decision
# ---------------------------------------------------------------------------
def nodo_revision_humana(state: AdvisoryState) -> dict:
    decision = state.get("decision")
    if not decision:
        raise RuntimeError(
            "El nodo de revisión se ejecutó sin decisión del asesor. "
            "El grafo debe reanudarse solo tras POST /review/{id}/decision."
        )
    estados = {"approve": "aprobada", "edit": "editada", "reject": "rechazada"}
    return {"estado_final": estados[decision["decision"]]}


# ---------------------------------------------------------------------------
# Nodo 8 — AUDITORÍA (append-only + retroalimentación bayesiana)
# ---------------------------------------------------------------------------
def nodo_auditoria(state: AdvisoryState) -> dict:
    from app.models import AdvisorDecision, Proposal  # import tardío evita ciclos

    decision = state["decision"]
    db = SessionLocal()
    try:
        proposal = db.get(Proposal, state["proposal_id"])
        if proposal is None:
            raise RuntimeError(f"Propuesta {state['proposal_id']} no encontrada")

        # 1) Registro APPEND-ONLY con snapshot completo y versiones de modelo
        registro = AdvisorDecision(
            proposal_id=proposal.id,
            decision=decision["decision"],
            asesor=decision["asesor"],
            comentario=decision.get("comentario", ""),
            edits=decision.get("distribucion_editada") or {},
            rules_version=state["perfil_reglas"]["rules_version"],
            posterior_version=state["posterior"]["version"],
            snapshot={
                "perfil": state["perfil_final"],
                "confianza": state["confianza"],
                "distribucion": state["propuesta"]["distribucion"],
                "proyeccion_params": {
                    "modelo": state["proyeccion"]["modelo"],
                    "retorno_mensual_esperado": state["proyeccion"][
                        "retorno_mensual_esperado"
                    ],
                    "volatilidad_mensual": state["proyeccion"]["volatilidad_mensual"],
                },
                "alerta_cumplimiento": state.get("alerta_cumplimiento", {}),
                "explicacion": state["explicacion"],
                "guardrail_activado": state.get("guardrail_activado", False),
                "llm_provider": state.get("llm_provider", "n/d"),
            },
        )
        db.add(registro)

        # 2) Estado de la propuesta (y edición del asesor si aplica)
        proposal.estado = state["estado_final"]
        if decision["decision"] == "edit" and decision.get("distribucion_editada"):
            editada = decision["distribucion_editada"]
            proposal.distribucion = {
                "original": proposal.distribucion,
                "editada_por_asesor": editada,
            }

        # 3) RETROALIMENTACIÓN BAYESIANA: la decisión actualiza el posterior
        post = risk_posterior.update_posterior(
            db, state["client_id"], state["perfil_final"], decision["decision"]
        )
        resumen_post = risk_posterior.posterior_summary(post)

        db.commit()
        audit_id = registro.id
    finally:
        db.close()

    return {"audit_id": audit_id, "posterior_actualizado": resumen_post}
