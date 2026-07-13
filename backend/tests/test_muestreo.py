"""Tests de muestreo estratificado/intencional y reporte de calidad."""
import pytest

from app.rules.estratos import SIN_CLASIFICAR, compute_estratos
from app.workflows import pilot_mode
from app.workflows.asesoria_workflow import start_advisory
from tests.conftest import RESPUESTAS_AGRESIVO, RESPUESTAS_CONSERVADOR, RESPUESTAS_MODERADO


def test_estratos_joven_principiante_bajo():
    e = compute_estratos(RESPUESTAS_CONSERVADOR)
    assert e["edad_rango"] == "adulto_mayor"  # RESPUESTAS_CONSERVADOR usa edad="d"
    assert e["experiencia_nivel"] == "principiante"  # experiencia="a"
    assert e["segmento_saldo"] == "bajo"  # capacidad_inversion="a"


def test_estratos_agresivo():
    e = compute_estratos(RESPUESTAS_AGRESIVO)
    assert e["edad_rango"] == "joven"  # edad="a"
    assert e["experiencia_nivel"] == "avanzado"  # experiencia="d"
    assert e["segmento_saldo"] == "muy_alto"  # capacidad_inversion="d"


def test_estratos_defensivo_ante_datos_incompletos():
    e = compute_estratos({})
    assert e["edad_rango"] == SIN_CLASIFICAR
    assert e["segmento_saldo"] == SIN_CLASIFICAR
    assert e["experiencia_nivel"] == SIN_CLASIFICAR


def test_pilot_status_publico(client):
    r = client.get("/profiling/pilot-status")
    assert r.status_code == 200
    assert r.json()["enabled"] is False


def test_pilot_mode_protegido(client):
    assert client.get("/pilot-mode").status_code == 401


def test_pilot_mode_set_get(client, operator_headers):
    r = client.put(
        "/pilot-mode", json={"enabled": True, "sample_fraction": 0.5}, headers=operator_headers
    )
    assert r.status_code == 200
    r2 = client.get("/profiling/pilot-status")
    assert r2.json() == {"enabled": True, "sample_fraction": 0.5}


def test_pilot_mode_validacion(db):
    with pytest.raises(ValueError):
        pilot_mode.set_config(db, enabled=True, sample_fraction=2.0)


def test_payload_persiste_respuestas_meta(db):
    resultado = start_advisory(
        db,
        cliente={"nombre": "Meta", "email": "m@t.com"},
        respuestas=RESPUESTAS_MODERADO,
        respuestas_meta=[
            {"question_id": "edad", "selected_option": "c", "seconds_spent": 12.5, "option_changes_count": 1}
        ],
        test_metadata={"is_pilot_sample": True, "device": "mobile"},
        retroalimentacion_general="Todo claro",
    )
    from app.models import RiskProfileRecord

    registro = db.query(RiskProfileRecord).filter_by(client_id=resultado["client_id"]).one()
    assert registro.test_metadata["is_pilot_sample"] is True
    assert registro.retroalimentacion_general == "Todo claro"
    assert registro.respuestas_meta[0]["question_id"] == "edad"


def test_payload_compatible_sin_muestreo(db):
    """Compatibilidad hacia atrás: respuestas_meta/test_metadata son opcionales."""
    resultado = start_advisory(
        db, cliente={"nombre": "Simple", "email": "s@t.com"}, respuestas=RESPUESTAS_MODERADO
    )
    assert resultado["estado"] == "pendiente"


def test_quality_report_estructura(client, operator_headers, db):
    for i in range(3):
        start_advisory(
            db, cliente={"nombre": f"C{i}", "email": f"c{i}@t.com"}, respuestas=RESPUESTAS_MODERADO
        )
    r = client.get("/review/quality-report", headers=operator_headers)
    assert r.status_code == 200
    body = r.json()
    assert "cronbach" in body
    assert "estratos" in body
    assert "tiempos_por_pregunta" in body
    assert "feedback" in body


def test_cronbach_alpha_requiere_minimo_dos_registros(db):
    from app.analytics.quality_report import cronbach_alpha

    r = cronbach_alpha(db)
    assert r["alfa"] is None


def test_cronbach_alpha_calcula_con_datos_variados(db):
    from app.analytics.quality_report import cronbach_alpha

    start_advisory(db, {"nombre": "A", "email": "a@a.com"}, RESPUESTAS_AGRESIVO)
    start_advisory(db, {"nombre": "B", "email": "b@b.com"}, RESPUESTAS_CONSERVADOR)
    start_advisory(db, {"nombre": "C", "email": "c@c.com"}, RESPUESTAS_MODERADO)
    r = cronbach_alpha(db)
    assert r["alfa"] is not None
    assert -1.0 <= r["alfa"] <= 1.0


def test_caso_critico_marcado_por_zscore(db):
    """Cinco tiempos 'normales' + uno atípico -> debe marcarse como crítico."""
    from app.analytics.quality_report import question_timing_stats

    tiempos_normales = [10, 11, 9, 10, 12]
    tiempo_atipico = 300
    for t in tiempos_normales + [tiempo_atipico]:
        start_advisory(
            db,
            cliente={"nombre": "T", "email": "t@t.com"},
            respuestas=RESPUESTAS_MODERADO,
            respuestas_meta=[{"question_id": "edad", "seconds_spent": t, "option_changes_count": 0}],
            test_metadata={"is_pilot_sample": True},
        )
    stats = question_timing_stats(db)
    fila_edad = next(f for f in stats if f["question_id"] == "edad")
    assert len(fila_edad["casos_criticos"]) >= 1
