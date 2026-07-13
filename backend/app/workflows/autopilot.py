"""MODO AUTOPILOTO — autonomía por excepción (`autopilot-v1`).

El sistema se GANA la autonomía estadísticamente: apagado por defecto (opt-in
del operador). Cuando la confianza bayesiana (posterior Beta-Binomial) de un
cliente supera el umbral configurado y NO hay alertas de Cumplimiento, el
Autopiloto aprueba solo — firmando la auditoría como "ODDS-Autopilot v1" con
el umbral y la confianza usados. Los casos de excepción siguen yendo al
humano. Nunca ejecuta órdenes reales; configurable por jurisdicción.
"""
from sqlalchemy.orm import Session

from app.models import Proposal, SystemSetting

AUTOPILOT_VERSION = "autopilot-v1"
SETTING_KEY = "autopilot"
DEFAULT_CONFIG = {"enabled": False, "umbral": 0.75}
ASESOR_AUTOPILOT = "ODDS-Autopilot v1"


def get_config(db: Session) -> dict:
    setting = db.query(SystemSetting).filter_by(key=SETTING_KEY).one_or_none()
    if setting is None:
        return dict(DEFAULT_CONFIG)
    return {**DEFAULT_CONFIG, **setting.value}


def set_config(db: Session, enabled: bool, umbral: float) -> dict:
    if not (0.0 <= umbral <= 1.0):
        raise ValueError("El umbral debe estar entre 0.0 y 1.0")
    setting = db.query(SystemSetting).filter_by(key=SETTING_KEY).one_or_none()
    valor = {"enabled": enabled, "umbral": umbral}
    if setting is None:
        setting = SystemSetting(key=SETTING_KEY, value=valor)
        db.add(setting)
    else:
        setting.value = valor
    db.commit()
    return valor


def maybe_auto_approve(db: Session, proposal: Proposal) -> dict | None:
    """Si el Autopiloto está activado, la confianza supera el umbral y no hay
    alertas de Cumplimiento, aprueba la propuesta automáticamente.

    Devuelve el resultado de resume_advisory() si auto-aprobó, o None si el
    caso sigue esperando revisión humana.
    """
    config = get_config(db)
    if not config["enabled"]:
        return None
    if proposal.confianza < config["umbral"]:
        return None
    alertas = (proposal.alerta_cumplimiento or {}).get("alertas", [])
    if alertas:
        return None  # una alerta de Cumplimiento revoca la autonomía

    from app.workflows.asesoria_workflow import resume_advisory  # evita ciclo

    decision = {
        "decision": "approve",
        "asesor": ASESOR_AUTOPILOT,
        "comentario": (
            f"Auto-aprobado: confianza {proposal.confianza:.2%} >= umbral "
            f"{config['umbral']:.2%}, sin alertas de Cumplimiento."
        ),
    }
    resultado = resume_advisory(db, proposal, decision)
    resultado["autopilot"] = True
    return resultado


def stats(db: Session) -> dict:
    from app.models import AdvisorDecision  # import tardío evita ciclos

    config = get_config(db)
    total_propuestas = db.query(Proposal).count()
    aprobadas_auto = (
        db.query(AdvisorDecision).filter_by(asesor=ASESOR_AUTOPILOT).count()
    )
    return {
        "version": AUTOPILOT_VERSION,
        "config": config,
        "total_propuestas": total_propuestas,
        "aprobadas_por_autopiloto": aprobadas_auto,
    }
