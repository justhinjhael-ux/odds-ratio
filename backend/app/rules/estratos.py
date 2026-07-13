"""Muestreo ESTRATIFICADO (Historia 1) — clasificación determinística.

Etiqueta a cada inversionista con Estrato A (edad), B (capacidad económica /
saldo) y C (experiencia) a partir de respuestas YA recolectadas — nunca se
pregunta dos veces. Permite verificar cobertura proporcional entre segmentos
antes de confiar en cualquier métrica agregada (ej. Alfa de Cronbach).
"""
from app.rules.rules_engine import load_rules

SIN_CLASIFICAR = "sin_clasificar"


def _clasificar(opcion_id: str, grupos: dict[str, list[str]]) -> str:
    for etiqueta, opciones in grupos.items():
        if opcion_id in opciones:
            return etiqueta
    return SIN_CLASIFICAR


def compute_estratos(respuestas: dict[str, str]) -> dict[str, str]:
    """Devuelve {"edad_rango":..., "segmento_saldo":..., "experiencia_nivel":...}

    Defensivo: si falta la respuesta fuente o la opción no está mapeada,
    devuelve SIN_CLASIFICAR en vez de fallar (esto es información
    complementaria, nunca debe bloquear el flujo principal).
    """
    rules = load_rules()
    estratos_cfg = rules.get("estratos", {})
    preguntas = rules.get("preguntas", {})

    # Estrato A — edad
    cfg_a = estratos_cfg.get("estrato_a_edad", {})
    fuente_a = cfg_a.get("fuente", "edad")
    opcion_a = respuestas.get(fuente_a)
    edad_rango = (
        _clasificar(opcion_a, {k: v for k, v in cfg_a.items() if k != "fuente"})
        if opcion_a
        else SIN_CLASIFICAR
    )

    # Estrato B — capacidad económica / saldo (metadata en las opciones del YAML)
    cfg_b = estratos_cfg.get("estrato_b_saldo", {})
    fuente_b = cfg_b.get("fuente", "capacidad_inversion")
    opcion_b = respuestas.get(fuente_b)
    segmento_saldo = SIN_CLASIFICAR
    if opcion_b:
        opciones_b = preguntas.get(fuente_b, {}).get("opciones", {})
        segmento_saldo = opciones_b.get(opcion_b, {}).get("segmento_saldo", SIN_CLASIFICAR)

    # Estrato C — experiencia
    cfg_c = estratos_cfg.get("estrato_c_experiencia", {})
    fuente_c = cfg_c.get("fuente", "experiencia")
    opcion_c = respuestas.get(fuente_c)
    experiencia_nivel = (
        _clasificar(opcion_c, {k: v for k, v in cfg_c.items() if k != "fuente"})
        if opcion_c
        else SIN_CLASIFICAR
    )

    return {
        "edad_rango": edad_rango,
        "segmento_saldo": segmento_saldo,
        "experiencia_nivel": experiencia_nivel,
    }
