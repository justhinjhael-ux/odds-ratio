"""Motor de reglas determinístico de perfilamiento (Historia 1).

ANTIALUCINACIÓN: el perfil de riesgo se calcula EXCLUSIVAMENTE con estas reglas
versionadas (risk_rules_v1.yaml) + la actualización bayesiana. El LLM nunca
interviene en este cálculo — solo redacta explicaciones de números ya calculados.
"""
from functools import lru_cache
from pathlib import Path

import yaml

RULES_PATH = Path(__file__).parent / "risk_rules_v1.yaml"


@lru_cache(maxsize=1)
def load_rules() -> dict:
    with open(RULES_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def rules_version() -> str:
    return load_rules()["version"]


def evaluate_profile(respuestas: dict[str, str]) -> dict:
    """Aplica las reglas sobre las respuestas del cuestionario.

    Devuelve score, perfil y la influencia de CADA respuesta en el resultado
    (transparencia exigida por la Historia 1).

    Raises:
        ValueError: si falta una pregunta o la opción no existe.
    """
    rules = load_rules()
    preguntas = rules["preguntas"]

    faltantes = set(preguntas) - set(respuestas)
    if faltantes:
        raise ValueError(f"Faltan respuestas para: {sorted(faltantes)}")

    score = 0.0
    influencias = []
    for pid, opcion_id in respuestas.items():
        if pid not in preguntas:
            raise ValueError(f"Pregunta desconocida: {pid}")
        opciones = preguntas[pid]["opciones"]
        if opcion_id not in opciones:
            raise ValueError(f"Opción '{opcion_id}' inválida para pregunta '{pid}'")
        op = opciones[opcion_id]
        score += op["puntos"]
        influencias.append(
            {
                "pregunta": preguntas[pid]["texto"],
                "respuesta": op["texto"],
                "puntos": float(op["puntos"]),
                "explicacion": op["explicacion"],
            }
        )

    perfil = _score_to_profile(score, rules["perfiles"])
    return {
        "score": score,
        "perfil": perfil,
        "descripcion_perfil": rules["perfiles"][perfil]["descripcion"],
        "influencias": influencias,
        "rules_version": rules["version"],
    }


def _score_to_profile(score: float, perfiles: dict) -> str:
    for nombre, rango in perfiles.items():
        if rango["min"] <= score <= rango["max"]:
            return nombre
    # Fuera de rango teórico -> el más cercano (defensa ante cambios de YAML)
    return "conservador" if score < 0 else "agresivo"


def target_allocation(perfil: str) -> dict[str, float]:
    """Distribución objetivo por clase de activo según el perfil."""
    asignaciones = load_rules()["asignaciones"]
    if perfil not in asignaciones:
        raise ValueError(f"Perfil sin asignación definida: {perfil}")
    return {k: float(v) for k, v in asignaciones[perfil].items()}


def compliance_thresholds() -> dict[str, float]:
    """Umbrales de concentración del workflow de Cumplimiento/Riesgos."""
    return {
        k: float(v)
        for k, v in load_rules()["cumplimiento"]["umbrales_concentracion"].items()
    }


def pregunta_opcional() -> dict:
    """Pregunta OPCIONAL de retroalimentación metodológica (Historia 1).

    NUNCA puntúa ni participa en evaluate_profile — alimenta el muestreo
    intencional de casos críticos (ver app/rules/estratos.py y el reporte de
    calidad del cuestionario en GET /review/quality-report).
    """
    return load_rules()["pregunta_opcional"]
