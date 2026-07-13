"""Tests de los nodos del grafo LangGraph — guardrail antialucinación y
flujo E2E interrupt -> resume, con el LLM mockeado (LLM_PROVIDER=mock)."""
import pytest

from app.graph.nodes import validar_consistencia_numerica
from app.workflows.asesoria_workflow import resume_advisory, start_advisory
from tests.conftest import RESPUESTAS_MODERADO


def test_validar_consistencia_numerica_ok():
    datos = {"perfil": "moderado", "confianza": 0.5, "porcentaje": 30}
    texto = "Tu perfil es moderado con 30% en esta clase y 50% de confianza."
    # 50 no está en los datos (0.5 sí, pero como fracción, no como 50) -> debe fallar
    ok, extranos = validar_consistencia_numerica(texto, datos)
    assert not ok
    assert 50.0 in extranos


def test_validar_consistencia_numerica_pasa_con_datos_reales():
    datos = {"perfil": "moderado", "confianza": 0.5, "distribucion": [{"porcentaje": 30}]}
    texto = "Con 30% en esta clase, tu confianza es del sistema."
    ok, _ = validar_consistencia_numerica(texto, datos)
    assert ok


def test_validar_consistencia_numerica_detecta_alucinacion():
    datos = {"perfil": "moderado", "porcentaje": 30}
    texto_alucinado = "Podrías ganar un 500% en un mes si inviertes ya."
    ok, extranos = validar_consistencia_numerica(texto_alucinado, datos)
    assert not ok
    assert 500.0 in extranos


def test_flujo_e2e_interrupt_resume(db):
    resultado = start_advisory(
        db, cliente={"nombre": "Ana", "email": "ana@test.com"}, respuestas=RESPUESTAS_MODERADO
    )
    assert resultado["estado"] == "pendiente"
    assert resultado["perfil"] == "moderado"
    assert resultado["explicacion"]  # el mock siempre redacta algo

    from app.models import Proposal

    proposal = db.get(Proposal, resultado["proposal_id"])
    decision = {"decision": "approve", "asesor": "asesor_test", "comentario": "ok"}
    final = resume_advisory(db, proposal, decision)
    assert final["estado"] == "aprobada"
    assert final["posterior_actualizado"]["alpha"] > 2.0  # subió desde el prior


def test_doble_decision_bloqueada(db):
    resultado = start_advisory(
        db, cliente={"nombre": "Bob", "email": "bob@test.com"}, respuestas=RESPUESTAS_MODERADO
    )
    from app.models import Proposal

    proposal = db.get(Proposal, resultado["proposal_id"])
    decision = {"decision": "approve", "asesor": "asesor_test", "comentario": ""}
    resume_advisory(db, proposal, decision)

    proposal_actualizada = db.get(Proposal, resultado["proposal_id"])
    assert proposal_actualizada.estado == "aprobada"
    with pytest.raises(RuntimeError):
        # revision_humana ya se ejecutó; el grafo no debe volver a correr sin
        # una nueva propuesta.
        resume_advisory(db, proposal_actualizada, decision)
