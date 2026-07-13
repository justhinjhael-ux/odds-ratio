"""Estado compartido del grafo LangGraph — un dict tipado que cada nodo lee
y actualiza parcialmente (LangGraph mergea los dicts devueltos por cada nodo).
"""
from typing import TypedDict


class AdvisoryState(TypedDict, total=False):
    # Entrada inicial
    client_id: int
    proposal_id: int
    respuestas: dict[str, str]
    horizonte_meses: int
    monto_inicial: float

    # Nodo 1 — perfilamiento
    perfil_reglas: dict

    # Nodo 2 — posterior bayesiano
    posterior: dict
    perfil_final: str
    confianza: float

    # Nodo 3 — propuesta
    propuesta: dict

    # Nodo 4 — proyección
    proyeccion: dict

    # Nodo 5 — cumplimiento
    alerta_cumplimiento: dict

    # Nodo 6 — explicación LLM
    explicacion: str
    guardrail_activado: bool
    llm_provider: str

    # Nodo 7 — revisión humana (llega vía resume tras el interrupt)
    decision: dict
    estado_final: str

    # Nodo 8 — auditoría
    audit_id: int
    posterior_actualizado: dict
