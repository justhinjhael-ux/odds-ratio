"""Workflow departamental #2 — Cumplimiento/Riesgos (SIMULADO).

Marca ALERTAS de concentración por clase de activo contra los umbrales
versionados en risk_rules_v1.yaml. NUNCA bloquea ni ejecuta nada — regla
obligatoria del track: toda alerta queda como flag para revisión humana.
"""
from app.rules import rules_engine

WORKFLOW_VERSION = "cumplimiento-v1"


def check_concentration(distribucion_pct: dict[str, float]) -> dict:
    umbrales = rules_engine.compliance_thresholds()
    alertas = []
    for clase, pct in distribucion_pct.items():
        umbral = umbrales.get(clase)
        if umbral is not None and pct > umbral:
            alertas.append(
                {
                    "clase": clase,
                    "porcentaje": pct,
                    "umbral": umbral,
                    "mensaje": (
                        f"Concentración en '{clase}' ({pct}%) supera el umbral "
                        f"de Cumplimiento ({umbral}%). Solo informativo — no bloquea."
                    ),
                }
            )
    return {"version": WORKFLOW_VERSION, "ok": len(alertas) == 0, "alertas": alertas}
