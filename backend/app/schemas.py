"""Esquemas Pydantic — contratos de entrada/salida de la API."""
from pydantic import BaseModel, Field


class ClienteIn(BaseModel):
    nombre: str = Field("", max_length=200)
    email: str = Field("", max_length=200)


class RespuestaMeta(BaseModel):
    """Metadatos de una respuesta individual — solo se llenan en Modo Piloto
    (muestreo intencional): tiempo de permanencia y vacilación (cambios de
    opción), más un feedback puntual opcional por pregunta."""

    question_id: str
    selected_option: str = ""
    seconds_spent: float = Field(0, ge=0)
    option_changes_count: int = Field(0, ge=0)
    user_feedback: str = ""


class TestMetadata(BaseModel):
    is_pilot_sample: bool = False
    device: str = ""


class QuestionnaireIn(BaseModel):
    cliente: ClienteIn
    respuestas: dict[str, str]
    horizonte_meses: int = Field(60, ge=1, le=600)
    monto_inicial: float = Field(10_000.0, gt=0)
    respuestas_meta: list[RespuestaMeta] = Field(default_factory=list)
    test_metadata: TestMetadata = Field(default_factory=TestMetadata)
    retroalimentacion_general: str = Field("", max_length=2000)


class DecisionIn(BaseModel):
    decision: str = Field(..., pattern="^(approve|edit|reject)$")
    asesor: str = Field(..., min_length=1, max_length=100)
    comentario: str = Field("", max_length=2000)
    distribucion_editada: dict[str, float] | None = None


class ChatIn(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    mensaje: str = Field(..., min_length=1, max_length=2000)


class LoginIn(BaseModel):
    usuario: str
    clave: str


class AutopilotIn(BaseModel):
    enabled: bool
    umbral: float = Field(..., ge=0.0, le=1.0)


class PilotModeIn(BaseModel):
    enabled: bool
    sample_fraction: float = Field(..., ge=0.0, le=1.0)
