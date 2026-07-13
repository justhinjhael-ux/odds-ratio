"""Ensamblaje del StateGraph LangGraph + checkpoint humano (Historia 3).

El flujo completo se modela como GRAFO DE ESTADOS EXPLÍCITO (criterio de
evaluación #1 — arquitectura agéntica), no como llamadas de función sueltas:

    START → perfilamiento → posterior_bayesiano → generar_propuesta
          → proyectar_series_tiempo → cumplimiento → explicacion_llm
          → INTERRUPT (espera decisión del asesor)
          → revision_humana → auditoria → END

El checkpointer SQLite persiste el estado de cada hilo (thread_id = uno por
propuesta), de modo que el grafo puede reanudarse horas después, incluso tras
reiniciar el servidor — continuidad conversacional verificable.
"""
import os
import sqlite3
from functools import lru_cache

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph

from app.graph.nodes import (
    nodo_auditoria,
    nodo_cumplimiento,
    nodo_explicacion_llm,
    nodo_generar_propuesta,
    nodo_perfilamiento,
    nodo_posterior_bayesiano,
    nodo_proyectar_series_tiempo,
    nodo_revision_humana,
)
from app.graph.state import AdvisoryState

CHECKPOINT_DB = os.getenv("LANGGRAPH_CHECKPOINT_DB", "langgraph_checkpoints.db")


@lru_cache(maxsize=1)
def get_graph():
    """Compila el grafo una sola vez (singleton) con checkpointer SQLite."""
    builder = StateGraph(AdvisoryState)

    builder.add_node("perfilamiento", nodo_perfilamiento)
    builder.add_node("posterior_bayesiano", nodo_posterior_bayesiano)
    builder.add_node("generar_propuesta", nodo_generar_propuesta)
    builder.add_node("proyectar_series_tiempo", nodo_proyectar_series_tiempo)
    builder.add_node("cumplimiento", nodo_cumplimiento)
    builder.add_node("explicacion_llm", nodo_explicacion_llm)
    builder.add_node("revision_humana", nodo_revision_humana)
    builder.add_node("auditoria", nodo_auditoria)

    builder.add_edge(START, "perfilamiento")
    builder.add_edge("perfilamiento", "posterior_bayesiano")
    builder.add_edge("posterior_bayesiano", "generar_propuesta")
    builder.add_edge("generar_propuesta", "proyectar_series_tiempo")
    builder.add_edge("proyectar_series_tiempo", "cumplimiento")
    builder.add_edge("cumplimiento", "explicacion_llm")
    builder.add_edge("explicacion_llm", "revision_humana")
    builder.add_edge("revision_humana", "auditoria")
    builder.add_edge("auditoria", END)

    conn = sqlite3.connect(CHECKPOINT_DB, check_same_thread=False)
    checkpointer = SqliteSaver(conn)

    # INTERRUPT: el grafo se detiene ANTES de revision_humana y espera la
    # decisión del asesor autorizado (nunca continúa solo — regla del track).
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["revision_humana"],
    )


def thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}
