"""Router de autenticación, configuración (Autopiloto/Modo Piloto) y ranking."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_operator, verify_login
from app.bayes.client_ranking import ranking
from app.database import get_db
from app.schemas import AutopilotIn, LoginIn, PilotModeIn
from app.workflows import autopilot, pilot_mode

router = APIRouter(tags=["clients"])


@router.post("/auth/login")
def login(payload: LoginIn):
    token = verify_login(payload.usuario, payload.clave)
    if token is None:
        raise HTTPException(status_code=401, detail="Usuario o clave incorrectos")
    return {"token": token}


@router.get("/autopilot", dependencies=[Depends(require_operator)])
def get_autopilot(db: Session = Depends(get_db)):
    return autopilot.get_config(db)


@router.put("/autopilot", dependencies=[Depends(require_operator)])
def set_autopilot(payload: AutopilotIn, db: Session = Depends(get_db)):
    return autopilot.set_config(db, payload.enabled, payload.umbral)


@router.get("/pilot-mode", dependencies=[Depends(require_operator)])
def get_pilot_mode(db: Session = Depends(get_db)):
    return pilot_mode.get_config(db)


@router.put("/pilot-mode", dependencies=[Depends(require_operator)])
def set_pilot_mode(payload: PilotModeIn, db: Session = Depends(get_db)):
    return pilot_mode.set_config(db, payload.enabled, payload.sample_fraction)


@router.get("/clients/ranking", dependencies=[Depends(require_operator)])
def clients_ranking(db: Session = Depends(get_db)):
    return ranking(db)
