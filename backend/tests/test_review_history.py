"""Tests de GET /review/history — las 3 Historias consolidadas para el asesor."""
from app.workflows.asesoria_workflow import resume_advisory, start_advisory
from tests.conftest import RESPUESTAS_MODERADO


def test_history_incluye_las_tres_historias(client, operator_headers, db):
    resultado = start_advisory(
        db, cliente={"nombre": "Historia", "email": "h@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    r = client.get("/review/history", headers=operator_headers)
    assert r.status_code == 200
    fila = next(f for f in r.json() if f["propuesta"]["proposal_id"] == resultado["proposal_id"])

    # Historia 1 — perfil transparente
    assert fila["perfil"]["perfil"] == "moderado"
    assert len(fila["perfil"]["influencias"]) == 10
    assert "estratos" in fila["perfil"]

    # Historia 2 — propuesta explicable
    assert fila["propuesta"]["distribucion"]
    assert fila["propuesta"]["explicacion"]

    # Historia 3 — revisión (aún pendiente)
    assert fila["revision"]["estado"] == "pendiente"
    assert fila["revision"]["asesor"] is None


def test_history_refleja_decision_del_asesor(client, operator_headers, db):
    resultado = start_advisory(
        db, cliente={"nombre": "Decidido", "email": "d@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    from app.models import Proposal

    proposal = db.get(Proposal, resultado["proposal_id"])
    resume_advisory(db, proposal, {"decision": "approve", "asesor": "asesor_1", "comentario": "ok"})

    r = client.get("/review/history", headers=operator_headers)
    fila = next(f for f in r.json() if f["propuesta"]["proposal_id"] == resultado["proposal_id"])
    assert fila["revision"]["estado"] == "aprobada"
    assert fila["revision"]["asesor"] == "asesor_1"
    assert fila["revision"]["decision"] == "approve"


def test_history_requiere_operador(client):
    assert client.get("/review/history").status_code == 401
