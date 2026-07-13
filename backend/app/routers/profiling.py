"""Router /profiling — cuestionario transparente (Historia 1)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.rules import rules_engine
from app.workflows import pilot_mode

router = APIRouter(prefix="/profiling", tags=["profiling"])


@router.get("/questionnaire")
def get_questionnaire():
    rules = rules_engine.load_rules()
    return {
        "version": rules["version"],
        "preguntas": rules["preguntas"],
        "pregunta_opcional": rules_engine.pregunta_opcional(),
    }


@router.get("/pilot-status")
def pilot_status(db: Session = Depends(get_db)):
    """Público — el frontend hace su propia tirada de dado con sample_fraction."""
    return pilot_mode.get_config(db)


@router.post("/evaluate")
def evaluate(respuestas: dict[str, str]):
    """Vista previa del perfil sin persistir nada (útil para depurar el
    cuestionario en el frontend antes de crear una propuesta real)."""
    return rules_engine.evaluate_profile(respuestas)
