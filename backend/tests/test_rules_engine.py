"""Tests de la función crítica de perfilamiento (rules_engine)."""
import pytest

from app.rules import rules_engine
from tests.conftest import RESPUESTAS_AGRESIVO, RESPUESTAS_CONSERVADOR, RESPUESTAS_MODERADO


def test_perfil_agresivo():
    r = rules_engine.evaluate_profile(RESPUESTAS_AGRESIVO)
    assert r["perfil"] == "agresivo"
    assert r["score"] == 100


def test_perfil_conservador():
    r = rules_engine.evaluate_profile(RESPUESTAS_CONSERVADOR)
    assert r["perfil"] == "conservador"
    assert r["score"] <= 40


def test_perfil_moderado():
    r = rules_engine.evaluate_profile(RESPUESTAS_MODERADO)
    assert r["perfil"] == "moderado"
    assert 41 <= r["score"] <= 73


def test_diez_preguntas_obligatorias():
    rules = rules_engine.load_rules()
    assert len(rules["preguntas"]) == 10


def test_pregunta_opcional_no_puntua():
    opcional = rules_engine.pregunta_opcional()
    assert "puntos" not in opcional
    assert opcional["id"] == "retroalimentacion_general"


def test_influencias_incluyen_explicacion():
    r = rules_engine.evaluate_profile(RESPUESTAS_MODERADO)
    assert len(r["influencias"]) == 10
    for inf in r["influencias"]:
        assert inf["explicacion"]
        assert inf["pregunta"]


def test_version_presente():
    r = rules_engine.evaluate_profile(RESPUESTAS_MODERADO)
    assert r["rules_version"] == "1.1.0"


def test_faltan_respuestas_lanza_error():
    incompletas = dict(RESPUESTAS_MODERADO)
    del incompletas["edad"]
    with pytest.raises(ValueError):
        rules_engine.evaluate_profile(incompletas)


def test_opcion_invalida_lanza_error():
    invalidas = dict(RESPUESTAS_MODERADO)
    invalidas["edad"] = "z"
    with pytest.raises(ValueError):
        rules_engine.evaluate_profile(invalidas)


def test_pregunta_desconocida_lanza_error():
    invalidas = dict(RESPUESTAS_MODERADO)
    invalidas["pregunta_inexistente"] = "a"
    with pytest.raises(ValueError):
        rules_engine.evaluate_profile(invalidas)


def test_asignaciones_suman_100():
    rules = rules_engine.load_rules()
    for perfil, asignacion in rules["asignaciones"].items():
        assert sum(asignacion.values()) == 100, f"{perfil} no suma 100%"


def test_target_allocation_perfil_invalido():
    with pytest.raises(ValueError):
        rules_engine.target_allocation("inexistente")
