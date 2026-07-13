"""Router /proposals — crea y consulta propuestas (arranca el grafo)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Proposal, RiskProfileRecord
from app.schemas import QuestionnaireIn
from app.workflows.asesoria_workflow import start_advisory

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _serialize(db: Session, p: Proposal) -> dict:
    registro = db.query(RiskProfileRecord).filter_by(proposal_id=p.id).one_or_none()
    return {
        "proposal_id": p.id,
        "client_id": p.client_id,
        "thread_id": p.thread_id,
        "perfil": p.perfil,
        "confianza": p.confianza,
        "distribucion": p.distribucion,
        "proyeccion": p.proyeccion,
        "explicacion": p.explicacion,
        "estado": p.estado,
        "rules_version": p.rules_version,
        "posterior_version": p.posterior_version,
        "guardrail_activado": p.guardrail_activado,
        "llm_provider": p.llm_provider,
        "alerta_cumplimiento": p.alerta_cumplimiento,
        "score": registro.score if registro else None,
        "influencias": registro.detalle.get("influencias", []) if registro else [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("")
def create_proposal(payload: QuestionnaireIn, db: Session = Depends(get_db)):
    resultado = start_advisory(
        db,
        cliente=payload.cliente.model_dump(),
        respuestas=payload.respuestas,
        horizonte_meses=payload.horizonte_meses,
        monto_inicial=payload.monto_inicial,
        respuestas_meta=[r.model_dump() for r in payload.respuestas_meta],
        test_metadata=payload.test_metadata.model_dump(),
        retroalimentacion_general=payload.retroalimentacion_general,
    )
    return resultado


@router.get("/{proposal_id}")
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    p = db.get(Proposal, proposal_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    return _serialize(db, p)


@router.get("")
def list_proposals(db: Session = Depends(get_db)):
    return [_serialize(db, p) for p in db.query(Proposal).order_by(Proposal.id.desc()).all()]
