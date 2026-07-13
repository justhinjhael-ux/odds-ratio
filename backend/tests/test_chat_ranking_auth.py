"""Tests de chat (guardrail + escalamiento), login/token de operadores y
ranking bayesiano de clientes."""
from app.workflows.asesoria_workflow import resume_advisory, start_advisory
from tests.conftest import RESPUESTAS_AGRESIVO, RESPUESTAS_CONSERVADOR


def test_chat_escala_solicitud_inversion(client):
    r = client.post("/chat", json={"session_id": "s1", "mensaje": "¿En qué debo invertir?"})
    assert r.status_code == 200
    body = r.json()
    assert body["escalado"] is True


def test_chat_no_escala_pregunta_general(client):
    r = client.post("/chat", json={"session_id": "s2", "mensaje": "¿Qué es Odds Ratio?"})
    assert r.status_code == 200
    assert r.json()["escalado"] is False


def test_chat_logs_requiere_token(client):
    r = client.get("/chat/logs")
    assert r.status_code == 401


def test_chat_logs_con_token(client, operator_headers):
    client.post("/chat", json={"session_id": "s3", "mensaje": "Hola"})
    r = client.get("/chat/logs", headers=operator_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 2  # user + assistant


def test_login_correcto(client):
    r = client.post("/auth/login", json={"usuario": "operador", "clave": "oddsratio2026"})
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_incorrecto(client):
    r = client.post("/auth/login", json={"usuario": "operador", "clave": "mala"})
    assert r.status_code == 401


def test_endpoints_protegidos_devuelven_401(client):
    for path in ("/review/pending", "/review/history", "/review/quality-report", "/review/audit", "/clients/ranking"):
        assert client.get(path).status_code == 401


def test_ranking_ordenado_y_autoalimentado(client, operator_headers, db):
    r1 = start_advisory(db, {"nombre": "Cliente Agresivo", "email": "a@t.com"}, RESPUESTAS_AGRESIVO)
    r2 = start_advisory(db, {"nombre": "Cliente Conservador", "email": "c@t.com"}, RESPUESTAS_CONSERVADOR)

    from app.models import Proposal

    for res in (r1, r2):
        p = db.get(Proposal, res["proposal_id"])
        if p.estado == "pendiente":
            resume_advisory(db, p, {"decision": "approve", "asesor": "op", "comentario": ""})

    r = client.get("/clients/ranking", headers=operator_headers)
    assert r.status_code == 200
    filas = r.json()
    assert len(filas) >= 2
    scores = [f["score"] for f in filas]
    assert scores == sorted(scores, reverse=True)


def test_bank_priors_acciones_mayor_que_renta_fija():
    from app.bayes.returns_forecast import posterior_predictive

    acciones = posterior_predictive("acciones")
    renta_fija = posterior_predictive("renta_fija_local")
    assert acciones["mu_posterior"] > renta_fija["mu_posterior"]
