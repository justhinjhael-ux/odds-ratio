"""Reporte de CALIDAD del cuestionario — cierra el ciclo del muestreo.

Consume lo que recolectan las dos infraestructuras de muestreo (Historia 1):

  1. MUESTREO ESTRATIFICADO: cuenta cuántos perfiles hay por Estrato A/B/C
     (edad_rango, segmento_saldo, experiencia_nivel) — permite verificar que
     el cuestionario tiene cobertura proporcional entre segmentos antes de
     confiar en cualquier métrica agregada.

  2. MUESTREO INTENCIONAL / CASOS CRÍTICOS: agrega el feedback puntual por
     pregunta + el tiempo de permanencia (time-on-page) y la vacilación
     (cambios de opción) capturados SOLO en sesiones del Modo Piloto, y marca
     como "atípico" cualquier tiempo que se aleje más de 2 desviaciones
     estándar del promedio de esa pregunta (z-score) — señal de que la
     pregunta puede estar confusa o mal redactada.

  3. ALFA DE CRONBACH real: se calcula con los puntos de las 10 preguntas
     OBLIGATORIAS ya guardados en RiskProfileRecord.detalle["influencias"]
     — ningún número se inventa, es la fórmula estándar de consistencia
     interna aplicada a datos reales ya recolectados.

Todo esto es INFORMACIÓN para el asesor/operador — nunca decide nada por sí
sola; el objetivo es que la decisión final del asesor esté mejor informada.
"""
import numpy as np
from sqlalchemy.orm import Session

from app.models import RiskProfileRecord
from app.rules import rules_engine

QUALITY_REPORT_VERSION = "quality-report-v1"
Z_SCORE_ATIPICO = 2.0  # umbral estándar para marcar un tiempo como caso crítico


def cronbach_alpha(db: Session) -> dict:
    """Alfa de Cronbach real sobre las 10 preguntas obligatorias vigentes.

    Solo usa registros con la MISMA versión de reglas (mismas 10 preguntas y
    misma escala de puntos) para no mezclar escalas distintas entre sí.
    """
    version_vigente = rules_engine.rules_version()
    registros = (
        db.query(RiskProfileRecord)
        .filter_by(rules_version=version_vigente)
        .all()
    )

    if len(registros) < 2:
        return {
            "alfa": None,
            "n_registros": len(registros),
            "nota": "Se necesitan al menos 2 cuestionarios completos para calcular consistencia interna.",
        }

    # Matriz (n_registros x n_items) de puntos por pregunta, en el MISMO orden
    matriz = np.array(
        [[inf["puntos"] for inf in r.detalle.get("influencias", [])] for r in registros]
    )
    if matriz.ndim != 2 or matriz.shape[1] < 2:
        return {"alfa": None, "n_registros": len(registros), "nota": "Datos insuficientes por ítem."}

    k = matriz.shape[1]
    var_items = matriz.var(axis=0, ddof=1)
    var_total = matriz.sum(axis=1).var(ddof=1)
    if var_total == 0:
        return {"alfa": None, "n_registros": len(registros), "nota": "Sin varianza total (todas las respuestas idénticas)."}

    alfa = (k / (k - 1)) * (1 - var_items.sum() / var_total)
    return {
        "alfa": round(float(alfa), 4),
        "n_items": k,
        "n_registros": len(registros),
        "rules_version": version_vigente,
        "interpretacion": _interpretar_alfa(alfa),
    }


def _interpretar_alfa(alfa: float) -> str:
    if alfa >= 0.9:
        return "Excelente consistencia interna"
    if alfa >= 0.8:
        return "Buena consistencia interna"
    if alfa >= 0.7:
        return "Aceptable — estándar mínimo para un cuestionario de perfilamiento"
    if alfa >= 0.6:
        return "Cuestionable — revisar ítems de baja correlación con el total"
    return "Pobre — el cuestionario necesita revisión metodológica"


def question_timing_stats(db: Session) -> list[dict]:
    """Tiempo de permanencia y vacilación por pregunta (solo datos del Modo
    Piloto, donde el frontend captura estas métricas silenciosamente).

    Marca como CASO CRÍTICO cualquier respuesta individual cuyo tiempo se
    aleje más de Z_SCORE_ATIPICO desviaciones estándar del promedio de esa
    misma pregunta — útil para detectar preguntas confusas o mal redactadas.
    """
    registros = db.query(RiskProfileRecord).all()

    # Agrupa (question_id -> lista de {seconds_spent, option_changes_count, ...})
    por_pregunta: dict[str, list[dict]] = {}
    for r in registros:
        for meta in r.respuestas_meta or []:
            qid = meta.get("question_id")
            if not qid or meta.get("seconds_spent", 0) <= 0:
                continue  # sin dato real de tiempo -> no aporta a la estadística
            por_pregunta.setdefault(qid, []).append(
                {
                    "client_id": r.client_id,
                    "seconds_spent": meta.get("seconds_spent", 0),
                    "option_changes_count": meta.get("option_changes_count", 0),
                    "user_feedback": meta.get("user_feedback", ""),
                }
            )

    resultado = []
    for qid, muestras in por_pregunta.items():
        tiempos = np.array([m["seconds_spent"] for m in muestras])
        media = float(tiempos.mean())
        desv = float(tiempos.std(ddof=1)) if len(tiempos) > 1 else 0.0

        atipicos = []
        for m in muestras:
            z = (m["seconds_spent"] - media) / desv if desv > 0 else 0.0
            if abs(z) > Z_SCORE_ATIPICO:
                atipicos.append({**m, "z_score": round(float(z), 2)})

        resultado.append(
            {
                "question_id": qid,
                "n_muestras": len(muestras),
                "tiempo_promedio_seg": round(media, 1),
                "desviacion_seg": round(desv, 1),
                "vacilacion_promedio": round(
                    float(np.mean([m["option_changes_count"] for m in muestras])), 2
                ),
                "casos_criticos": atipicos,
            }
        )
    return sorted(resultado, key=lambda x: x["question_id"])


def feedback_agregado(db: Session) -> dict:
    """Retroalimentación cualitativa recolectada — el corazón del muestreo
    intencional: comentarios puntuales por pregunta + la pregunta OPCIONAL
    general de fin de cuestionario."""
    registros = db.query(RiskProfileRecord).all()

    por_pregunta = []
    generales = []
    for r in registros:
        for meta in r.respuestas_meta or []:
            texto = (meta.get("user_feedback") or "").strip()
            if texto:
                por_pregunta.append(
                    {"question_id": meta.get("question_id"), "client_id": r.client_id, "texto": texto}
                )
        if (r.retroalimentacion_general or "").strip():
            generales.append({"client_id": r.client_id, "texto": r.retroalimentacion_general.strip()})

    return {"por_pregunta": por_pregunta, "generales": generales}


def estratos_summary(db: Session) -> dict:
    """Distribución de la muestra por Estrato A/B/C — para verificar cobertura
    proporcional antes de confiar en cualquier métrica agregada."""
    registros = db.query(RiskProfileRecord).all()
    resumen = {"edad_rango": {}, "segmento_saldo": {}, "experiencia_nivel": {}}
    for r in registros:
        for clave, valor in (r.estratos or {}).items():
            if clave in resumen:
                resumen[clave][valor] = resumen[clave].get(valor, 0) + 1
    return {"n_total": len(registros), "distribucion": resumen}


def full_report(db: Session) -> dict:
    """Reporte consolidado — lo que consume el Panel Operativo."""
    return {
        "version": QUALITY_REPORT_VERSION,
        "cronbach": cronbach_alpha(db),
        "estratos": estratos_summary(db),
        "tiempos_por_pregunta": question_timing_stats(db),
        "feedback": feedback_agregado(db),
    }
