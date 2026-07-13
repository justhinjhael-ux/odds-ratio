"""MODO PILOTO — muestreo intencional / casos críticos (Historia 1).

Feature flag: cuando está activo, una fracción configurable de las sesiones
del cuestionario captura EN SILENCIO tiempo de permanencia y vacilación
(cambios de opción) por pregunta, y habilita un ícono discreto de feedback
puntual. El frontend hace su propia "tirada de dado" (Math.random() <
sample_fraction) — el backend nunca decide por sesión individual, solo
publica la fracción configurada vía GET /profiling/pilot-status (público).
"""
from sqlalchemy.orm import Session

from app.models import SystemSetting

PILOT_VERSION = "pilot-sampling-v1"
SETTING_KEY = "pilot_mode"
DEFAULT_CONFIG = {"enabled": False, "sample_fraction": 0.2}


def get_config(db: Session) -> dict:
    setting = db.query(SystemSetting).filter_by(key=SETTING_KEY).one_or_none()
    if setting is None:
        return dict(DEFAULT_CONFIG)
    return {**DEFAULT_CONFIG, **setting.value}


def set_config(db: Session, enabled: bool, sample_fraction: float) -> dict:
    if not (0.0 <= sample_fraction <= 1.0):
        raise ValueError("sample_fraction debe estar entre 0.0 y 1.0")
    setting = db.query(SystemSetting).filter_by(key=SETTING_KEY).one_or_none()
    valor = {"enabled": enabled, "sample_fraction": sample_fraction}
    if setting is None:
        setting = SystemSetting(key=SETTING_KEY, value=valor)
        db.add(setting)
    else:
        setting.value = valor
    db.commit()
    return valor
