"""Tests del Modo Autopiloto: apagado por defecto, umbral, autonomía ganada,
alertas de Cumplimiento revocan la autonomía."""
import pytest

from app.models import Proposal
from app.workflows import autopilot
from app.workflows.asesoria_workflow import start_advisory
from tests.conftest import RESPUESTAS_MODERADO


def test_apagado_por_defecto(db):
    config = autopilot.get_config(db)
    assert config["enabled"] is False


def test_confianza_bajo_umbral_va_a_humano(db):
    autopilot.set_config(db, enabled=True, umbral=0.95)
    resultado = start_advisory(
        db, cliente={"nombre": "X", "email": "x@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    assert resultado["estado"] == "pendiente"  # confianza inicial (0.5) < 0.95


def test_autoaprobacion_firmada(db):
    autopilot.set_config(db, enabled=True, umbral=0.4)  # confianza inicial 0.5 >= 0.4
    resultado = start_advisory(
        db, cliente={"nombre": "Y", "email": "y@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    assert resultado["autopilot_aplicado"] is True
    assert resultado["estado"] == "aprobada"

    from app.models import AdvisorDecision

    registro = (
        db.query(AdvisorDecision)
        .filter_by(proposal_id=resultado["proposal_id"])
        .one()
    )
    assert registro.asesor == autopilot.ASESOR_AUTOPILOT


def test_alerta_cumplimiento_revoca_autonomia(db, monkeypatch):
    autopilot.set_config(db, enabled=True, umbral=0.1)

    from app.workflows import cumplimiento_workflow

    def _alerta_falsa(pesos):
        return {"version": "test", "ok": False, "alertas": [{"clase": "acciones", "mensaje": "test"}]}

    monkeypatch.setattr(cumplimiento_workflow, "check_concentration", _alerta_falsa)
    # nodo_cumplimiento importa check_concentration directamente -> parchear ahí también
    from app.graph import nodes as graph_nodes

    monkeypatch.setattr(graph_nodes, "check_concentration", _alerta_falsa)

    resultado = start_advisory(
        db, cliente={"nombre": "Z", "email": "z@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    assert resultado["estado"] == "pendiente"  # la alerta bloqueó la auto-aprobación


def test_validacion_umbral_fuera_de_rango(db):
    with pytest.raises(ValueError):
        autopilot.set_config(db, enabled=True, umbral=1.5)
