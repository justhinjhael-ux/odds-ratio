"""Fixtures compartidas — fuerza LLM_PROVIDER=mock y una BD de pruebas limpia."""
import os

os.environ["LLM_PROVIDER"] = "mock"
os.environ["ODDS_RATIO_DB"] = "sqlite:///./test_odds_ratio.db"
os.environ["LANGGRAPH_CHECKPOINT_DB"] = "test_langgraph_checkpoints.db"
os.environ.setdefault("OPERATOR_USER", "operador")
os.environ.setdefault("OPERATOR_PASS", "oddsratio2026")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.auth import _token  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def operator_headers():
    return {"X-Operator-Token": _token()}


# ---------------------------------------------------------------------------
# Fixtures de respuestas — 10 preguntas obligatorias del cuestionario v1.1.0.
# OJO: en "edad" la escala está invertida (18-30="a"=10pts ... 60+="d"=1pt);
# en el resto de preguntas "a" es el extremo conservador y "d" el agresivo.
# ---------------------------------------------------------------------------
RESPUESTAS_AGRESIVO = {
    "edad": "a",
    "horizonte": "d",
    "tolerancia_caida": "d",
    "experiencia": "d",
    "proporcion_patrimonio": "d",
    "ingresos": "d",
    "objetivo_financiero": "d",
    "conocimiento_financiero": "d",
    "capacidad_inversion": "d",
    "perdida_sostenida": "d",
}  # score = 100 (10x10) -> agresivo

RESPUESTAS_CONSERVADOR = {
    "edad": "d",
    "horizonte": "a",
    "tolerancia_caida": "a",
    "experiencia": "a",
    "proporcion_patrimonio": "a",
    "ingresos": "a",
    "objetivo_financiero": "a",
    "conocimiento_financiero": "a",
    "capacidad_inversion": "a",
    "perdida_sostenida": "a",
}  # score = 1*9 + 2 (ingresos) = 11 -> conservador

RESPUESTAS_MODERADO = {
    "edad": "c",
    "horizonte": "c",
    "tolerancia_caida": "c",
    "experiencia": "c",
    "proporcion_patrimonio": "c",
    "ingresos": "c",
    "objetivo_financiero": "c",
    "conocimiento_financiero": "c",
    "capacidad_inversion": "c",
    "perdida_sostenida": "c",
}  # score = 4+7+7+7+7+8+7+7+7+7 = 68 -> moderado
